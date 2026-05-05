const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const { Product, Category, sequelize } = require('../models');

const app = express();
app.use(cors({
    origin: ["http://localhost:5173", "https://sweet-orders-jade.vercel.app"]
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "https://sweet-orders-jade.vercel.app""],
        methods: ["GET", "POST"] } 
});

let fakerLoopActive = false;
let fakerInterval = null;



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

app.post('/api/products', async (req, res) => {
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

app.delete('/api/products/:id', async (req, res) => {
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

const BAKERY_PRESETS = [
    {
        name: 'Ecler cu Vanilie',
        categoryId: 2, // Patiserie
        description: 'Ecler pufos umplut cu cremă fină de vanilie.',
        image: 'https://images.unsplash.com/photo-1629115913427-75871d02992e?w=400'
    },
    {
        name: 'Croissant cu Unt',
        categoryId: 2, // Patiserie
        description: 'Croissant fraged, preparat după o rețetă tradițională.',
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400'
    },
    {
        name: 'Tort Diplomat',
        categoryId: 4, // Torturi
        description: 'Tort răcoros cu frișcă naturală și fructe.',
        image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400'
    },
    {
        name: 'Limonadă cu Mentă',
        categoryId: 3, // Băuturi
        description: 'Băutură revigorantă din lămâi proaspete.',
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400'
    },
    {
        name: 'Amandine',
        categoryId: 1, // Dulciuri
        description: 'Prăjitură însiropată cu cremă de ciocolată.',
        image: 'https://images.unsplash.com/photo-1582231542122-c167bb6a80cc?w=400'
    }
];

const generateFakeProduct = () => {
    const preset = faker.helpers.arrayElement(BAKERY_PRESETS);

    return {
        name: preset.name,
        categoryId: preset.categoryId,
        price: Number((Math.random() * (80 - 5) + 5).toFixed(2)),
        description: preset.description,
        image: preset.image,
    };
};



app.post('/api/faker/start', (req, res) => {
    if (fakerInterval) return res.json({ message: 'Generatorul rulează deja.' });

    fakerLoopActive = true;
    fakerInterval = setInterval(async () => {
        if (!fakerLoopActive) {
            clearInterval(fakerInterval);
            fakerInterval = null;
            return;
        }
        try {
            const existingProducts = await Product.findAll({ attributes: ['name'] });
            const existingNames = new Set(existingProducts.map(p => p.name));

            const availablePresets = BAKERY_PRESETS.filter(p => !existingNames.has(p.name));

            if (availablePresets.length === 0) {
                console.log('Toate produsele unice au fost generate, oprim faker.');
                clearInterval(fakerInterval);
                fakerInterval = null;
                fakerLoopActive = false;
                io.emit('FAKER_STOPPED', { message: 'Toate produsele au fost generate.' });
                return;
            }

            const batchSize = Math.min(3, availablePresets.length);
            const selectedPresets = faker.helpers.shuffle(availablePresets).slice(0, batchSize);
            const batchData = selectedPresets.map(preset => ({
                ...preset,
                price: Number((Math.random() * (80 - 5) + 5).toFixed(2)),
            }));

            const newProducts = await Product.bulkCreate(batchData);
            const fullProducts = await Product.findAll({
                where: { id: newProducts.map(p => p.id) },
                include: [{ model: Category, as: 'category' }]
            });

            io.emit('FAKER_BATCH', fullProducts);
            console.log(`[Database] Inserate: ${fullProducts.map(p => p.name).join(', ')}`);
        } catch (err) {
            console.error("Eroare generator:", err);
        }
    }, 3000);

    res.json({ message: 'Generator pornit (3 produse / 3 sec).' });
});

app.post('/api/faker/stop', (req, res) => {
    fakerLoopActive = false;
    if (fakerInterval) {
        clearInterval(fakerInterval);
        fakerInterval = null;
    }
    res.json({ message: 'Generator oprit.' });
});


app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, image, categoryId } = req.body;

     
        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({ error: 'Produsul nu a fost găsit.' });
        }

        await product.update({
            name,
            price,
            description,
            image,
            categoryId: parseInt(categoryId) 
        });

        
        const updatedProduct = await Product.findByPk(id, {
            include: [{ model: Category, as: 'category' }]
        });

        
        io.emit('PRODUCT_UPDATED', updatedProduct);

        res.json(updatedProduct);
    } catch (error) {
        console.error("Server update error:", error);
        res.status(400).json({ error: error.message });
    }
});


const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await sequelize.sync({ alter: true });

        const categories = [
            { id: 1, name: 'Dulciuri' },
            { id: 2, name: 'Patiserie' },
            { id: 3, name: 'Băuturi' },
            { id: 4, name: 'Torturi' }
        ];

        for (const cat of categories) {
            await Category.findOrCreate({
                where: { id: cat.id },
                defaults: { name: cat.name }
            });
        }

        console.log('Toate categoriile au fost verificate/create.');
        server.listen(PORT, () => console.log(`Running on ${PORT}`));
    } catch (error) {
        console.error(error);
    }
};


startServer();