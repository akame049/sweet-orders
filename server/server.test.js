import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';


const makeApp = () => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    let products = [
        { id: 1, name: "Chocolate Dream Cake", category: "Cakes", price: 45.00, description: "Un tort bogat cu ciocolată.", image: "" },
        { id: 2, name: "Butter Croissants", category: "Pastries", price: 4.50, description: "Croissante fragede cu unt.", image: "" },
        { id: 3, name: "Fruit Tart", category: "Cakes", price: 28.00, description: "O tartă crocantă cu fructe.", image: "" },
    ];
    let nextId = 4;

    const validateProduct = (body) => {
        const errors = [];
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2)
            errors.push('Numele trebuie să aibă cel puțin 2 caractere.');
        if (body.price === undefined || isNaN(Number(body.price)) || Number(body.price) <= 0)
            errors.push('Prețul trebuie să fie un număr pozitiv.');
        if (!body.category || typeof body.category !== 'string' || body.category.trim().length < 2)
            errors.push('Categoria trebuie să aibă cel puțin 2 caractere.');
        if (!body.description || typeof body.description !== 'string' || body.description.trim().length < 5)
            errors.push('Descrierea trebuie să aibă cel puțin 5 caractere.');
        return errors;
    };

    app.get('/api/products', (req, res) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 5));
        const total = products.length;
        const totalPages = Math.ceil(total / limit);
        const data = products.slice((page - 1) * limit, page * limit);
        res.json({ data, page, limit, total, totalPages });
    });

    app.get('/api/products/:id', (req, res) => {
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({ error: 'Produs negăsit.' });
        res.json(product);
    });

    app.post('/api/products', (req, res) => {
        const errors = validateProduct(req.body);
        if (errors.length > 0) return res.status(400).json({ errors });
        const newProduct = {
            id: nextId++,
            name: req.body.name.trim(),
            category: req.body.category.trim(),
            price: Number(Number(req.body.price).toFixed(2)),
            description: req.body.description.trim(),
            image: req.body.image || '',
        };
        products.push(newProduct);
        res.status(201).json(newProduct);
    });

    app.put('/api/products/:id', (req, res) => {
        const idx = products.findIndex(p => p.id === parseInt(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Produs negăsit.' });
        const errors = validateProduct(req.body);
        if (errors.length > 0) return res.status(400).json({ errors });
        products[idx] = { ...products[idx], ...req.body, id: products[idx].id };
        res.json(products[idx]);
    });

    app.delete('/api/products/:id', (req, res) => {
        const idx = products.findIndex(p => p.id === parseInt(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Produs negăsit.' });
        const deleted = products.splice(idx, 1)[0];
        res.json({ message: 'Produs șters.', id: deleted.id });
    });

    app.get('/api/stats', (req, res) => {
        const byCategory = products.reduce((acc, p) => {
            acc[p.category] = (acc[p.category] || 0) + 1;
            return acc;
        }, {});
        const prices = products.map(p => p.price);
        res.json({
            total: products.length,
            avgPrice: prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0,
            minPrice: prices.length ? Math.min(...prices) : 0,
            maxPrice: prices.length ? Math.max(...prices) : 0,
            byCategory,
        });
    });

    return app;
};


describe('CRUD API Tests', () => {
    let app;
    beforeEach(() => { app = makeApp(); });

   
    describe('GET /api/products', () => {
        test('returnează lista paginată', async () => {
            const res = await request(app).get('/api/products?page=1&limit=2');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.total).toBe(3);
            expect(res.body.totalPages).toBe(2);
        });

        test('page 2 returnează produsul rămas', async () => {
            const res = await request(app).get('/api/products?page=2&limit=2');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });

    describe('GET /api/products/:id', () => {
        test('găsește produsul existent', async () => {
            const res = await request(app).get('/api/products/1');
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Chocolate Dream Cake');
        });

        test('returnează 404 pentru ID inexistent', async () => {
            const res = await request(app).get('/api/products/999');
            expect(res.status).toBe(404);
        });
    });

    
    describe('POST /api/products', () => {
        const validProduct = {
            name: 'Test Cake',
            category: 'Cakes',
            price: 20,
            description: 'O descriere validă',
            image: '',
        };

        test('creează un produs valid', async () => {
            const res = await request(app).post('/api/products').send(validProduct);
            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Test Cake');
            expect(res.body.id).toBeDefined();
        });

        test('respinge produs fără nume', async () => {
            const res = await request(app).post('/api/products').send({ ...validProduct, name: '' });
            expect(res.status).toBe(400);
            expect(res.body.errors).toBeDefined();
        });

        test('respinge preț negativ', async () => {
            const res = await request(app).post('/api/products').send({ ...validProduct, price: -5 });
            expect(res.status).toBe(400);
        });

        test('respinge preț zero', async () => {
            const res = await request(app).post('/api/products').send({ ...validProduct, price: 0 });
            expect(res.status).toBe(400);
        });

        test('respinge descriere prea scurtă', async () => {
            const res = await request(app).post('/api/products').send({ ...validProduct, description: 'abc' });
            expect(res.status).toBe(400);
        });
    });

 
    describe('PUT /api/products/:id', () => {
        test('actualizează un produs existent', async () => {
            const res = await request(app).put('/api/products/1').send({
                name: 'Updated Cake', category: 'Cakes', price: 50, description: 'Descriere actualizată'
            });
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Cake');
        });

        test('returnează 404 pentru ID inexistent', async () => {
            const res = await request(app).put('/api/products/999').send({
                name: 'X', category: 'Y', price: 10, description: 'descriere'
            });
            expect(res.status).toBe(404);
        });

        test('respinge date invalide la update', async () => {
            const res = await request(app).put('/api/products/1').send({ name: '', category: '', price: -1, description: '' });
            expect(res.status).toBe(400);
        });
    });

   
    describe('DELETE /api/products/:id', () => {
        test('șterge un produs existent', async () => {
            const res = await request(app).delete('/api/products/1');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(1);
        });

        test('returnează 404 pentru ID inexistent', async () => {
            const res = await request(app).delete('/api/products/999');
            expect(res.status).toBe(404);
        });

        test('produsul nu mai există după ștergere', async () => {
            await request(app).delete('/api/products/1');
            const res = await request(app).get('/api/products/1');
            expect(res.status).toBe(404);
        });
    });


    describe('GET /api/stats', () => {
        test('returnează statistici corecte', async () => {
            const res = await request(app).get('/api/stats');
            expect(res.status).toBe(200);
            expect(res.body.total).toBe(3);
            expect(res.body.byCategory['Cakes']).toBe(2);
            expect(Number(res.body.avgPrice)).toBeGreaterThan(0);
        });
    });
});
