const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { faker } = require('@faker-js/faker');
const { Product, Category, User, Role, Permission, sequelize } = require('../models');

const authRoutes = require('../routes/auth');
const chatRoutes = require('../routes/chat');
const { getDb } = require('../routes/chat');

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://sweet-orders-jade.vercel.app"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'sweetorders_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

let fakerLoopActive = false;
let fakerInterval = null;

// ─── Auth & Chat Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// ─── Middleware: check auth ───────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Neautentificat.' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session?.user?.roles?.includes('admin'))
        return res.status(403).json({ error: 'Acces interzis. Necesită rol admin.' });
    next();
};

// ─── Products CRUD ────────────────────────────────────────────────────────────
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

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [{ model: Category, as: 'category' }]
        });
        if (!product) return res.status(404).json({ error: 'Produs negăsit.' });
        res.json(product);
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

app.put('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Produsul nu a fost găsit.' });

        await product.update(req.body);
        const updatedProduct = await Product.findByPk(req.params.id, {
            include: [{ model: Category, as: 'category' }]
        });
        io.emit('PRODUCT_UPDATED', updatedProduct);
        res.json(updatedProduct);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        io.emit('PRODUCT_DELETED', req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await Product.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalProducts'],
                [sequelize.fn('AVG', sequelize.col('price')), 'averagePrice']
            ]
        });
        res.json(stats[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Faker ────────────────────────────────────────────────────────────────────
const BAKERY_ITEMS = [
    { name: 'Chocolate Lava Cake', category: 'Cakes', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400' },
    { name: 'Almond Croissant', category: 'Pastries', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400' },
    { name: 'Lemon Tart', category: 'Pies', image: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400' },
    { name: 'Red Velvet Cupcake', category: 'Cakes', image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400' },
    { name: 'Pecan Pie', category: 'Pies', image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400' },
    { name: 'Chocolate Chip Cookies', category: 'Cookies', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400' },
    { name: 'Sourdough Bread', category: 'Breads', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' },
    { name: 'Cinnamon Roll', category: 'Pastries', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400' },
];

const BAKERY_DESCRIPTIONS = [
    'Freshly baked with premium ingredients.',
    'A classic recipe passed down through generations.',
    'Rich, indulgent, and perfectly golden.',
    'Light and fluffy with a delicate glaze.',
];

const FAKER_CATEGORIES = { 'Cakes': 4, 'Pastries': 2, 'Cookies': 1, 'Pies': 1, 'Breads': 2 };

app.post('/api/faker/start', requireAdmin, (req, res) => {
    if (fakerInterval) return res.json({ message: 'Generatorul rulează deja.' });

    fakerLoopActive = true;
    fakerInterval = setInterval(async () => {
        if (!fakerLoopActive) { clearInterval(fakerInterval); fakerInterval = null; return; }
        try {
            const existingProducts = await Product.findAll({ attributes: ['name'] });
            const existingNames = new Set(existingProducts.map(p => p.name));
            const available = BAKERY_ITEMS.filter(p => !existingNames.has(p.name));

            if (available.length === 0) {
                clearInterval(fakerInterval); fakerInterval = null; fakerLoopActive = false;
                io.emit('FAKER_STOPPED'); return;
            }

            const selected = faker.helpers.shuffle(available).slice(0, Math.min(3, available.length));
            const batchData = selected.map(item => ({
                name: item.name,
                categoryId: FAKER_CATEGORIES[item.category] || 1,
                price: Number((Math.random() * 75 + 5).toFixed(2)),
                description: faker.helpers.arrayElement(BAKERY_DESCRIPTIONS),
                image: item.image,
                isFaker: true,
            }));

            const newProducts = await Product.bulkCreate(batchData);
            const fullProducts = await Product.findAll({
                where: { id: newProducts.map(p => p.id) },
                include: [{ model: Category, as: 'category' }]
            });
            io.emit('FAKER_BATCH', fullProducts);
        } catch (err) { console.error("Eroare generator:", err); }
    }, 3000);

    res.json({ message: 'Generator pornit.' });
});

app.post('/api/faker/stop', requireAdmin, (req, res) => {
    fakerLoopActive = false;
    if (fakerInterval) { clearInterval(fakerInterval); fakerInterval = null; }
    res.json({ message: 'Generator oprit.' });
});

// ─── Socket.io Chat ───────────────────────────────────────────────────────────
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
            const message = {
                text: data.text,
                username: data.username,
                userId: data.userId,
                roles: data.roles,
                timestamp: new Date()
            };

            // Salvăm în MongoDB
            const db = await getDb();
            await db.collection('messages').insertOne(message);

            // Trimitem tuturor
            io.to('general').emit('chat:message', message);
        } catch (err) {
            console.error('Eroare chat:', err);
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

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await sequelize.sync({ alter: true });

        // Seed categorii
        const categories = [
            { id: 1, name: 'Dulciuri' }, { id: 2, name: 'Patiserie' },
            { id: 3, name: 'Băuturi' }, { id: 4, name: 'Torturi' }
        ];
        for (const cat of categories) {
            await Category.findOrCreate({ where: { id: cat.id }, defaults: { name: cat.name } });
        }

        // Seed roluri
        const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' }, defaults: { description: 'Administrator cu acces complet' } });
        const [userRole] = await Role.findOrCreate({ where: { name: 'user' }, defaults: { description: 'Utilizator normal cu acces restricționat' } });

        // Seed permisiuni
        const permsList = [
            { name: 'products:read', description: 'Poate vedea produse' },
            { name: 'products:create', description: 'Poate adăuga produse' },
            { name: 'products:update', description: 'Poate edita produse' },
            { name: 'products:delete', description: 'Poate șterge produse' },
            { name: 'faker:control', description: 'Poate controla generatorul' },
        ];
        const perms = [];
        for (const p of permsList) {
            const [perm] = await Permission.findOrCreate({ where: { name: p.name }, defaults: p });
            perms.push(perm);
        }

        // Admin are toate permisiunile
        await adminRole.setPermissions(perms);
        // User are doar read
        const readPerm = perms.find(p => p.name === 'products:read');
        await userRole.setPermissions([readPerm]);

        // Seed admin user
        const [adminUser] = await User.findOrCreate({
            where: { email: 'admin@sweetorders.com' },
            defaults: { username: 'admin', email: 'admin@sweetorders.com', password: 'admin123' }
        });
        await adminUser.setRoles([adminRole]);

        console.log('✅ Seed complet — admin@sweetorders.com / admin123');
        server.listen(PORT, () => console.log(`✅ Running on ${PORT}`));
    } catch (error) {
        console.error(error);
    }
};

startServer();