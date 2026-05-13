const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');
const { Product, Category, User, Role, Permission, sequelize } = require('../models');

const authRoutes = require('../routes/auth');
const chatRoutes = require('../routes/chat');
// CORECȚIE: Importăm modelul Message pentru MongoDB
// Presupunând că exportul din chat.js include modelul Mongoose
const { Message } = require('../routes/chat');

const app = express();
app.set('trust proxy', 1);

// CORECȚIE: Adăugăm ambele variante de Vercel în CORS
const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app",
    "https://sweet-orders-frontend.vercel.app" // URL-ul din eroarea ta
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
}));

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'sweetorders_secret_key',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true, // true pentru Render (HTTPS)
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const server = http.createServer(app);

// CORECȚIE: Configurare Socket.io stabilă pentru Render
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

let fakerInterval = null;

// Rute
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// --- Middleware: check auth ---
const requireAuth = (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Neautentificat.' });
    next();
};

const requireAdmin = (req, res, next) => {
    const userRoles = req.session?.user?.roles || [];
    if (!userRoles.includes('admin'))
        return res.status(403).json({ error: 'Acces interzis. Necesită rol admin.' });
    next();
};

// --- Rute Produse ---
app.get('/api/products', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const whereClause = categoryId && categoryId !== "" ? { categoryId: Number(categoryId) } : {};
        const products = await Product.findAll({
            where: whereClause,
            include: [{ model: Category, as: 'category' }]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', requireAuth, async (req, res) => {
    try {
        const newProduct = await Product.create(req.body);
        const fullProduct = await Product.findByPk(newProduct.id, {
            include: [{ model: Category, as: 'category' }]
        });
        io.emit('PRODUCT_ADDED', fullProduct);
        res.status(201).json(fullProduct);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- Faker Logic ---
const BAKERY_ITEMS = [
    { name: 'Chocolate Lava Cake', category: 'Cakes', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400' },
    { name: 'Almond Croissant', category: 'Pastries', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400' },
    { name: 'Lemon Tart', category: 'Pies', image: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400' },
    { name: 'Red Velvet Cupcake', category: 'Cakes', image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400' }
];

const FAKER_CATEGORIES = { 'Cakes': 4, 'Pastries': 2, 'Cookies': 1, 'Pies': 1, 'Breads': 2 };

app.post('/api/faker/start', requireAdmin, (req, res) => {
    if (fakerInterval) return res.json({ message: 'Generatorul rulează deja.' });

    fakerInterval = setInterval(async () => {
        try {
            const existingProducts = await Product.findAll({ attributes: ['name'] });
            const existingNames = new Set(existingProducts.map(p => p.name));
            const available = BAKERY_ITEMS.filter(p => !existingNames.has(p.name));

            if (available.length === 0) {
                clearInterval(fakerInterval);
                fakerInterval = null;
                io.emit('FAKER_STOPPED');
                return;
            }

            const selected = faker.helpers.shuffle(available).slice(0, Math.min(2, available.length));
            const batchData = selected.map(item => ({
                name: item.name,
                categoryId: FAKER_CATEGORIES[item.category] || 1,
                price: Number((Math.random() * 50 + 10).toFixed(2)),
                description: 'Proaspăt scos din cuptor!',
                image: item.image
            }));

            const newProducts = await Product.bulkCreate(batchData);
            const fullProducts = await Product.findAll({
                where: { id: newProducts.map(p => p.id) },
                include: [{ model: Category, as: 'category' }]
            });
            io.emit('FAKER_BATCH', fullProducts);
        } catch (err) { console.error("Eroare generator:", err); }
    }, 5000);

    res.json({ message: 'Generator pornit.' });
});

app.post('/api/faker/stop', requireAdmin, (req, res) => {
    if (fakerInterval) {
        clearInterval(fakerInterval);
        fakerInterval = null;
    }
    res.json({ message: 'Generator oprit.' });
});

// --- CORECȚIE: Socket.io Chat Logic ---
io.on('connection', (socket) => {
    console.log('Client conectat:', socket.id);

    socket.on('chat:join', (userData) => {
        socket.userData = userData;
        socket.join('general');
        io.to('general').emit('chat:userJoined', {
            username: userData.username,
            timestamp: new Date()
        });
    });

    socket.on('chat:message', async (data) => {
        try {
            const messageToSend = {
                username: data.username,
                text: data.text,
                userId: data.userId,
                roles: data.roles || [],
                timestamp: new Date()
            };

            // 1. Trimitem mesajul IMEDIAT către toți clienții (pentru UI live)
            io.emit('chat:message', messageToSend);

            // 2. Salvare în MongoDB folosind MongoClient (din chat.js)
            const db = await getDb();
            if (db) {
                await db.collection('messages').insertOne(messageToSend);
                console.log("Mesaj salvat în MongoDB");
            }
        } catch (err) {
            console.error("Eroare la procesarea mesajului:", err);
            // Nu mai trimitem io.emit aici pentru că a fost trimis deja sus
        }
    });

    socket.on('disconnect', () => {
        if (socket.userData) {
            io.to('general').emit('chat:userLeft', {
                username: socket.userData.username,
                timestamp: new Date()
            });
        }
    });
});

// --- Server Start ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await sequelize.sync();
        server.listen(PORT, () => console.log(`✅ Running on ${PORT}`));
    } catch (error) {
        console.error('Eroare start server:', error);
    }
};

startServer();