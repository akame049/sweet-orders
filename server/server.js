const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
// Ajustat calea către models (presupunând că models e în folderul rădăcină, un nivel mai sus de server)
const { Product, Category, sequelize } = require('../models');

const app = express();
app.use(express.json());

const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app",
    "https://sweet-orders-frontend.vercel.app"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST", "DELETE"] },
    transports: ['websocket', 'polling']
});

let fakerInterval = null;

// --- RUTE API ---

// 1. GET Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [{ model: Category, as: 'category' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. DELETE Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Product.destroy({ where: { id } });
        io.emit('products:update'); // Anunțăm live ștergerea
        res.json({ message: "Produs șters!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. FAKER START
app.post('/api/faker/start', async (req, res) => {
    if (fakerInterval) return res.json({ message: "Rulează deja" });

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
            io.emit('products:update'); // Anunțăm live adăugarea
        } catch (err) { console.error(err); }
    }, 5000);
    res.json({ message: "Pornit" });
});

// 4. FAKER STOP
app.post('/api/faker/stop', (req, res) => {
    if (fakerInterval) { clearInterval(fakerInterval); fakerInterval = null; }
    res.json({ message: "Oprit" });
});

const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
    server.listen(PORT, () => console.log(`🚀 Server pe portul ${PORT}`));
});