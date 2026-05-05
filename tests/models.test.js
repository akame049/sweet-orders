'use strict';

import { Sequelize, DataTypes } from 'sequelize';
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';

let sequelize;
let Category;
let Product;

beforeAll(async () => {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });

    Category = sequelize.define('Category', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    });

    Product = sequelize.define('Product', {
        name: DataTypes.STRING,
        price: DataTypes.FLOAT,
        description: DataTypes.TEXT,
        image: DataTypes.STRING,
        categoryId: DataTypes.INTEGER,
        isFaker: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });

    Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
    Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

    await sequelize.sync({ force: true });

    await Category.bulkCreate([
        { id: 1, name: 'Dulciuri' },
        { id: 2, name: 'Patiserie' },
        { id: 3, name: 'Băuturi' },
        { id: 4, name: 'Torturi' },
    ]);
});

afterAll(async () => {
    await sequelize.close();
});

beforeEach(async () => {
    await Product.destroy({ where: {} });
});


describe('Category Model', () => {

    test('creează o categorie validă', async () => {
        const cat = await Category.create({ name: 'Test Categorie' });
        expect(cat.id).toBeDefined();
        expect(cat.name).toBe('Test Categorie');
    });

    test('citește toate categoriile', async () => {
        const categories = await Category.findAll();
        expect(categories.length).toBeGreaterThanOrEqual(4);
    });

    test('găsește categoria după id', async () => {
        const cat = await Category.findByPk(1);
        expect(cat).not.toBeNull();
        expect(cat.name).toBe('Dulciuri');
    });

    test('actualizează numele categoriei', async () => {
        const cat = await Category.create({ name: 'Vechi' });
        await cat.update({ name: 'Nou' });
        const updated = await Category.findByPk(cat.id);
        expect(updated.name).toBe('Nou');
    });

    test('șterge o categorie', async () => {
        const cat = await Category.create({ name: 'De Sters' });
        const id = cat.id;
        await cat.destroy();
        const found = await Category.findByPk(id);
        expect(found).toBeNull();
    });

    test('nu permite categorie fără nume (allowNull: false)', async () => {
        await expect(Category.create({ name: null })).rejects.toThrow();
    });
});


describe('Product Model - Create', () => {

    test('creează un produs valid', async () => {
        const product = await Product.create({
            name: 'Chocolate Cake',
            price: 45.00,
            description: 'Un tort delicios',
            image: 'http://example.com/img.jpg',
            categoryId: 1,
        });
        expect(product.id).toBeDefined();
        expect(product.name).toBe('Chocolate Cake');
        expect(product.price).toBe(45.00);
    });

    test('creează mai multe produse cu bulkCreate', async () => {
        const products = await Product.bulkCreate([
            { name: 'Ecler', price: 10, description: 'Ecler cu vanilie', categoryId: 2 },
            { name: 'Croissant', price: 5, description: 'Croissant cu unt', categoryId: 2 },
            { name: 'Tiramisu', price: 30, description: 'Desert italian', categoryId: 1 },
        ]);
        expect(products.length).toBe(3);
    });

    test('câmpul isFaker are default false', async () => {
        const product = await Product.create({
            name: 'Normal Product',
            price: 20,
            description: 'Produs normal',
            categoryId: 1,
        });
        expect(product.isFaker).toBe(false);
    });

    test('creează produs faker cu isFaker true', async () => {
        const product = await Product.create({
            name: 'Faker Product',
            price: 15,
            description: 'Generat automat',
            categoryId: 2,
            isFaker: true,
        });
        expect(product.isFaker).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TESTS - READ
// ─────────────────────────────────────────────────────────────────────────────
describe('Product Model - Read', () => {

    beforeEach(async () => {
        await Product.bulkCreate([
            { name: 'Cake A', price: 20, description: 'Descriere A', categoryId: 1 },
            { name: 'Cake B', price: 40, description: 'Descriere B', categoryId: 1 },
            { name: 'Patiserie C', price: 10, description: 'Descriere C', categoryId: 2 },
        ]);
    });

    test('citește toate produsele', async () => {
        const products = await Product.findAll();
        expect(products.length).toBe(3);
    });

    test('găsește produs după id', async () => {
        const all = await Product.findAll();
        const found = await Product.findByPk(all[0].id);
        expect(found).not.toBeNull();
        expect(found.name).toBe('Cake A');
    });

    test('filtrează produse după categoryId', async () => {
        const products = await Product.findAll({ where: { categoryId: 1 } });
        expect(products.length).toBe(2);
        products.forEach(p => expect(p.categoryId).toBe(1));
    });

    test('include categoria la findAll', async () => {
        const products = await Product.findAll({
            include: [{ model: Category, as: 'category' }]
        });
        expect(products[0].category).not.toBeNull();
        expect(products[0].category.name).toBe('Dulciuri');
    });

    test('paginare - page 1', async () => {
        const page = 1;
        const limit = 2;
        const products = await Product.findAll({
            limit,
            offset: (page - 1) * limit,
        });
        expect(products.length).toBe(2);
    });

    test('paginare - page 2', async () => {
        const page = 2;
        const limit = 2;
        const products = await Product.findAll({
            limit,
            offset: (page - 1) * limit,
        });
        expect(products.length).toBe(1);
    });

    test('returnează 404 logic pentru produs inexistent', async () => {
        const found = await Product.findByPk(99999);
        expect(found).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TESTS - UPDATE
// ─────────────────────────────────────────────────────────────────────────────
describe('Product Model - Update', () => {

    test('actualizează prețul unui produs', async () => {
        const product = await Product.create({
            name: 'Update Test', price: 10, description: 'Test', categoryId: 1
        });
        await product.update({ price: 99.99 });
        const updated = await Product.findByPk(product.id);
        expect(updated.price).toBe(99.99);
    });

    test('actualizează mai multe câmpuri simultan', async () => {
        const product = await Product.create({
            name: 'Old Name', price: 10, description: 'Old desc', categoryId: 1
        });
        await product.update({
            name: 'New Name',
            price: 25,
            description: 'New desc',
            categoryId: 2
        });
        const updated = await Product.findByPk(product.id);
        expect(updated.name).toBe('New Name');
        expect(updated.price).toBe(25);
        expect(updated.categoryId).toBe(2);
    });

    test('schimbă categoria unui produs', async () => {
        const product = await Product.create({
            name: 'Cat Test', price: 15, description: 'Test', categoryId: 1
        });
        await product.update({ categoryId: 3 });
        const updated = await Product.findByPk(product.id);
        expect(updated.categoryId).toBe(3);
    });
});

describe('Product Model - Delete', () => {

    test('șterge un produs după id', async () => {
        const product = await Product.create({
            name: 'De Sters', price: 5, description: 'Test', categoryId: 1
        });
        const id = product.id;
        await Product.destroy({ where: { id } });
        const found = await Product.findByPk(id);
        expect(found).toBeNull();
    });

    test('șterge toate produsele faker', async () => {
        await Product.bulkCreate([
            { name: 'Faker 1', price: 10, description: 'Test', categoryId: 1, isFaker: true },
            { name: 'Faker 2', price: 20, description: 'Test', categoryId: 2, isFaker: true },
            { name: 'Normal', price: 30, description: 'Test', categoryId: 1, isFaker: false },
        ]);

        await Product.destroy({ where: { isFaker: true } });

        const remaining = await Product.findAll();
        expect(remaining.length).toBe(1);
        expect(remaining[0].name).toBe('Normal');
    });

    test('după ștergere produsul nu mai există', async () => {
        const product = await Product.create({
            name: 'Temp', price: 5, description: 'Temp', categoryId: 1
        });
        await product.destroy();
        const found = await Product.findByPk(product.id);
        expect(found).toBeNull();
    });
});

describe('Statistics', () => {

    beforeEach(async () => {
        await Product.bulkCreate([
            { name: 'P1', price: 10, description: 'D1', categoryId: 1 },
            { name: 'P2', price: 20, description: 'D2', categoryId: 1 },
            { name: 'P3', price: 30, description: 'D3', categoryId: 2 },
            { name: 'P4', price: 40, description: 'D4', categoryId: 2 },
        ]);
    });

    test('numără total produse', async () => {
        const total = await Product.count();
        expect(total).toBe(4);
    });

    test('calculează prețul mediu', async () => {
        const result = await Product.findOne({
            attributes: [
                [sequelize.fn('AVG', sequelize.col('price')), 'avgPrice']
            ],
            raw: true,
        });
        expect(Number(result.avgPrice)).toBe(25);
    });

    test('găsește prețul minim', async () => {
        const result = await Product.findOne({
            attributes: [
                [sequelize.fn('MIN', sequelize.col('price')), 'minPrice']
            ],
            raw: true,
        });
        expect(Number(result.minPrice)).toBe(10);
    });

    test('găsește prețul maxim', async () => {
        const result = await Product.findOne({
            attributes: [
                [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
            ],
            raw: true,
        });
        expect(Number(result.maxPrice)).toBe(40);
    });

    test('numără produse per categorie', async () => {
        const countCat1 = await Product.count({ where: { categoryId: 1 } });
        const countCat2 = await Product.count({ where: { categoryId: 2 } });
        expect(countCat1).toBe(2);
        expect(countCat2).toBe(2);
    });
});

describe('Relația Category - Product (1-to-many)', () => {

    test('categoria are multe produse', async () => {
        await Product.bulkCreate([
            { name: 'R1', price: 10, description: 'D1', categoryId: 1 },
            { name: 'R2', price: 20, description: 'D2', categoryId: 1 },
        ]);
        const cat = await Category.findByPk(1, {
            include: [{ model: Product, as: 'products' }]
        });
        expect(cat.products.length).toBe(2);
    });

    test('produsul aparține unei categorii', async () => {
        const product = await Product.create({
            name: 'Rel Test', price: 15, description: 'Test', categoryId: 2
        });
        const found = await Product.findByPk(product.id, {
            include: [{ model: Category, as: 'category' }]
        });
        expect(found.category.name).toBe('Patiserie');
    });
});