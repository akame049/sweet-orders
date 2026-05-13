const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');

// IMPORTĂ MODELELE ȘI RUTELE TALE EXISTENTE
const { Product, Category, User, Role, sequelize } = require('../models');
const authRoutes = require('../routes/auth'); // ASIGURĂ-TE CĂ ACEST FIȘIER EXISTĂ

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app",
    "https://sweet-orders-frontend.vercel.app"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

// CONFIGURARE SESIUNE (Necesară pentru Login)
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
const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ['websocket', 'polling']
});

// --- RUTELE DE AUTENTIFICARE (Aici se repară Login-ul) ---
app.use('/api/auth', authRoutes);

// --- RUTE PRODUSE ---
app.get('/api/products', async (req, res) => {
    try {
        const { categoryId } = req.query; // Preluăm categoria din filtrul frontend-ului

        // Dacă există categoryId și nu e gol, filtrăm. Dacă nu, luăm tot.
        const whereClause = categoryId && categoryId !== "" ? { categoryId: Number(categoryId) } : {};

        const products = await Product.findAll({
            where: whereClause,
            include: [{ model: Category, as: 'category' }],
            order: [['createdAt', 'DESC']]
        });

        res.json(products);
    } catch (error) {
        console.error("Eroare filtru:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        io.emit('products:update');
        res.json({ message: "Șters" });
    } catch (e) { res.status(500).send(e.message); }
});

// --- FAKER LIVE ---
let fakerInterval = null;
app.post('/api/faker/start', (req, res) => {
    if (fakerInterval) return res.json({ message: "Rulează deja" });
    fakerInterval = setInterval(async () => {
        try {
            const categories = await Category.findAll();
            if (categories.length === 0) {
                console.log("❌ Faker: Nu am găsit categorii în DB!");
                return;
            }

            const cat = categories[0];

            // Creăm produsul
            await Product.create({
                name: faker.commerce.productName(),
                price: 10.00,
                description: "Produs generat automat",
                image: `https://loremflickr.com/320/240/cake?lock=${Math.floor(Math.random() * 1000)}`,
                // Încearcă ambele variante dacă nu ești sigur de nume:
                categoryId: cat.id,
                // category_id: cat.id // Descomentează asta dacă prima dă eroare
            });

            console.log("✅ Faker: Produs nou creat!");
            io.emit('products:update');
        } catch (err) {
            console.error("❌ EROARE FAKER LA SALVARE:", err.message);
        }
    }, 5000);
    res.json({ message: "Pornit" });
});

app.post('/api/faker/stop', (req, res) => {
    clearInterval(fakerInterval);
    fakerInterval = null;
    res.json({ message: "Oprit" });
});

const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
    server.listen(PORT, () => console.log(`🚀 Server activ pe ${PORT}`));
});