const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');
const { Product, Category, User, Role, Permission, sequelize } = require('../models');

// --- IMPORT RUTE ---
const authRoutes = require('../routes/auth');
// Importăm prin destructurare: router-ul devine chatRoutes, și extragem getDb
const { router: chatRoutes, getDb } = require('../routes/chat');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app",
    "https://sweet-orders-frontend.vercel.app"
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
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

let fakerInterval = null;

// --- UTILIZARE RUTE ---
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes); // Acum chatRoutes este corect (doar router-ul)

// --- Rute Produse & Faker ---
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

app.post('/api/faker/start', async (req, res) => {
    if (!req.session.user || !req.session.user.roles.includes('admin')) {
        return res.status(403).json({ error: "Acces interzis. Admin required." });
    }
    if (fakerInterval) return res.json({ message: "Rulează deja!" });

    fakerInterval = setInterval(async () => {
        try {
            const categories = await Category.findAll();
            if (categories.length === 0) return;
            const randomCat = categories[Math.floor(Math.random() * categories.length)];

            await Product.create({
                name: faker.commerce.productName(),
                price: parseFloat(faker.commerce.price({ min: 10, max: 150 })),
                description: faker.commerce.productDescription(),
                image: `https://loremflickr.com/320/240/cake?lock=${Math.floor(Math.random() * 1000)}`,
                categoryId: randomCat.id
            });
            io.emit('products:update');
        } catch (err) { console.error(err); }
    }, 5000);
    res.json({ message: "Generare pornită!" });
});

app.post('/api/faker/stop', (req, res) => {
    if (fakerInterval) { clearInterval(fakerInterval); fakerInterval = null; }
    res.json({ message: "Generare oprită." });
});

// --- Socket.io Chat Logic ---
io.on('connection', (socket) => {
    socket.on('chat:join', (userData) => {
        socket.userData = userData;
        socket.join('general');
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
            io.emit('chat:message', messageToSend);

            const db = await getDb(); // Folosește funcția importată prin destructurare
            if (db) await db.collection('messages').insertOne(messageToSend);
        } catch (err) { console.error(err); }
    });
});

const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
    server.listen(PORT, () => console.log(`✅ Server pe portul ${PORT}`));
});