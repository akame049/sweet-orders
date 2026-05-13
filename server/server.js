const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');
// Atenție: Ajustează calea către '../models' dacă server.js e în folderul /server
const { Product, Category, User, Role, sequelize } = require('../models');

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
    cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
    transports: ['websocket', 'polling']
});

let fakerInterval = null;

// --- RUTE PRODUSE ---
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

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Product.destroy({ where: { id: id } });
        // Trimitem semnalul live că s-a șters ceva
        io.emit('products:update');
        res.json({ message: "Produs șters!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTE FAKER (SĂRIT PESTE ADMIN PENTRU DEBLOCARE) ---
app.post('/api/faker/start', async (req, res) => {
    if (fakerInterval) return res.json({ message: "Deja rulează!" });

    fakerInterval = setInterval(async () => {
        try {
            const categories = await Category.findAll();
            if (categories.length === 0) return;
            const randomCat = categories[Math.floor(Math.random() * categories.length)];

            await Product.create({
                name: faker.commerce.productName(),
                price: parseFloat(faker.commerce.price({ min: 5, max: 100 })),
                description: faker.commerce.productDescription(),
                image: `https://loremflickr.com/320/240/cake?lock=${Math.floor(Math.random() * 1000)}`,
                categoryId: randomCat.id
            });

            // TRIMITEM SEMNALUL CĂTRE FRONTEND
            io.emit('products:update');
        } catch (err) { console.error("Eroare Faker:", err); }
    }, 5000);
    res.json({ message: "Generare pornită!" });
});

app.post('/api/faker/stop', (req, res) => {
    if (fakerInterval) { clearInterval(fakerInterval); fakerInterval = null; }
    res.json({ message: "Generare oprită." });
});

// --- SOCKET.IO CONNECTION ---
io.on('connection', (socket) => {
    console.log('Client conectat:', socket.id);
    socket.on('disconnect', () => console.log('Client deconectat'));
});

const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
    server.listen(PORT, () => console.log(`✅ Server online pe portul ${PORT}`));
});