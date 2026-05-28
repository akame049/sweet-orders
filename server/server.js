const express = require('express');
const http = require('http'); // Schimbat din https în http pentru managementul automat de SSL din Render
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');
const { logAction } = require('./logger');

// 1. IMPORTURI MODELE ȘI RUTE
const { Product, Category, User, Role, Log, SuspiciousUser, sequelize } = require('../models');
const authRoutes = require('../routes/auth');
const chatRoutes = require('../routes/chat'); // Presupunând că ai ruta de chat separată

const app = express();
app.set('trust proxy', 1);

// Configurăm CORS pentru producție și mediu local
const allowedOrigins = [
    "http://localhost:5173",
    'https://sweet-orders-jade.vercel.app', 
    'https://sweet-orders-rgtd16vp0-akame049s-projects.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        // 1. Permite cererile fără origine (cum ar fi aplicațiile mobile sau Postman)
        if (!origin) return callback(null, true);

        // 2. Permite originile din lista fixă sau orice URL generat de Vercel pentru proiectul tău
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('.vercel.app')) {
            return callback(null, true);
        } else {
            return callback(new Error('Blocat de CORS (Origine nepermisă)'));
        }
    },
    credentials: true
}));
// 2. MIDDLEWARE-URI DE BAZĂ
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-sweet-orders-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true pe Render (HTTPS), false pe local
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 zi
    }
}));

// Aplicăm monitorizarea activităților suspecte
app.use(logAction);

// 3. SERVIREA FRONTEND-ULUI DIN ROOT (Folderul 'dist')
// IMPORTANT: Această linie trebuie pusă înainte de rutele wildcard, dar după middleware-uri
app.use(express.static(path.join(__dirname, '../dist')));

// 4. RUTELE DE API
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes.router || chatRoutes);

// Middleware simplu pentru verificare Admin
const requireAdmin = (req, res, next) => {
    if (req.session?.user?.roles?.includes('admin')) {
        return next();
    }
    res.status(403).json({ error: 'Acces interzis. Necesar rol de Admin.' });
};

// Rute pentru Produse direct în server.js (pe baza implementării tale)
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const offset = (page - 1) * limit;
        const { categoryId } = req.query;

        const whereClause = categoryId ? { categoryId } : {};

        const { count, rows } = await Product.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: Category, as: 'category' }]
        });

        res.json({
            products: rows,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.json(product);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        await Product.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Rute pentru LOGURI (Admin)
app.get('/api/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await Log.findAll({
            order: [['createdAt', 'DESC']],
            limit: 200
        });
        res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/logs/suspicious', requireAdmin, async (req, res) => {
    try {
        const suspects = await SuspiciousUser.findAll({
            where: { resolved: false },
            order: [['createdAt', 'DESC']]
        });
        res.json(suspects);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/logs/suspicious/:id/resolve', requireAdmin, async (req, res) => {
    try {
        await SuspiciousUser.update({ resolved: true }, { where: { id: req.params.id } });
        res.json({ message: 'Rezolvat' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. REDIRECȚIONARE CĂTRE REACT PENTRU RUTELE DE FRONTEND
// Dacă utilizatorul dă refresh la o pagină din browser (ex: /chat), Express va trimite corect index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 6. PORNIRE SERVER HTTP ȘI SOCKET.IO
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Permite conexiunea socket.io indiferent de domeniul public generat
        credentials: true
    }
});

// Logica Socket.io pentru Chat
io.on('connection', (socket) => {
    console.log('🔌 Utilizator conectat la sistemul de chat:', socket.id);

    socket.on('chat:join', (data) => {
        socket.join('sweetorders_room');
        console.log(`👥 ${data.username} s-a alăturat camerei de chat.`);
    });

    socket.on('chat:message', (msg) => {
        // Redirecționează mesajul primit către toți ceilalți clienți conectați
        io.to('sweetorders_room').emit('chat:message', msg);
    });

    socket.on('disconnect', () => {
        console.log('❌ Utilizator deconectat:', socket.id);
    });
});

// 7. SINCRONIZARE BAZĂ DE DATE ȘI PORNIRE LSTENER
sequelize.sync().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Serverul SweetOrders rulează în regim Production pe portul ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Nu s-a putut sincroniza baza de date Sequelize:', err.message);
});