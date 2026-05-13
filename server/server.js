const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');

// 1. IMPORTURI MODELE ȘI RUTE
const { Product, Category, User, Role, sequelize } = require('../models');
const authRoutes = require('../routes/auth');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app",
    "https://sweet-orders-frontend.vercel.app"
];

// 2. CONFIGURARE CORS
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

// 3. CONFIGURARE SESIUNE (Pentru a repara erorile 401 de Login)
app.use(session({
    secret: 'secret_key_sweet_orders',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const server = http.createServer(app);

// 4. CONFIGURARE SOCKET.IO (Chat + Produse Live)
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// 5. LOGICA SOCKET (AICI ESTE CHAT-UL!)
io.on('connection', (socket) => {
    console.log('✅ Client conectat:', socket.id);

    socket.on('chat:message', (data) => {
        // Trimite mesajul înapoi la toți (inclusiv expeditor)
        io.emit('chat:message', {
            ...data,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('chat:join', (data) => {
        io.emit('chat:userJoined', {
            username: data.username,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ Client deconectat');
    });
});

// 6. RUTE API
app.use('/api/auth', authRoutes);

// Rută dummy pentru chat ca să nu mai dea 404/SyntaxError în consolă
app.get('/api/chat/messages', (req, res) => {
    res.json([]);
});

// RUTA PRODUSE (Cu Filtrul Reparată)
app.get('/api/products', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const whereClause = categoryId && categoryId !== "" ? { categoryId: Number(categoryId) } : {};

        const products = await Product.findAll({
            where: whereClause,
            include: [{ model: Category, as: 'category' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RUTA DELETE (Cu Update Live)
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        io.emit('products:update'); // Anunță front-end-ul să dispară produsul
        res.json({ message: "Șters" });
    } catch (e) { res.status(500).send(e.message); }
});
// RUTA ADD PRODUS
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, description, image, categoryId } = req.body;
        const product = await Product.create({ name, price, description, image, categoryId });
        io.emit('products:update');
        res.json(product);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// RUTA EDIT PRODUS
app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, price, description, image, categoryId } = req.body;
        await Product.update({ name, price, description, image, categoryId }, { where: { id: req.params.id } });
        io.emit('products:update');
        res.json({ message: 'Actualizat' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. GENERATOR FAKER (Cu Update Live)
let fakerInterval = null;
app.post('/api/faker/start', async (req, res) => {
    if (fakerInterval) return res.json({ message: "Rulează deja" });

    console.log("🚀 Pornire Generator...");
    fakerInterval = setInterval(async () => {
        try {
            const categories = await Category.findAll();
            if (categories.length > 0) {
                const cat = categories[Math.floor(Math.random() * categories.length)];

                const newProduct = await Product.create({
                    name: `${faker.commerce.productName()} ${Math.floor(Math.random() * 999)}`,
                    price: parseFloat(faker.commerce.price({ min: 5, max: 50 })),
                    description: faker.commerce.productDescription(),
                    image: `https://loremflickr.com/320/240/cake?lock=${Math.floor(Math.random() * 1000)}`,
                    categoryId: cat.id
                });

                console.log("🍰 Produs creat:", newProduct.name);
                io.emit('products:update'); // Trimite semnalul live către front-end!
            }
        } catch (err) {
            console.error("❌ Eroare Faker:", err.message);
        }
    }, 3000);

    res.json({ message: "Generare pornită!" });
});

app.post('/api/faker/stop', (req, res) => {
    if (fakerInterval) {
        clearInterval(fakerInterval);
        fakerInterval = null;
    }
    res.json({ message: "Oprit" });
});

// 8. PORNIRE SERVER
const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
    server.listen(PORT, () => console.log(`✅ Serverul rulează pe portul ${PORT}`));
});