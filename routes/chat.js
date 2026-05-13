'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
let db;

const getDb = async () => {
    if (!db) {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db('sweetorders_chat');
    }
    return db;
};

// ─── GET /api/chat/messages ───────────────────────────────────────────────────
router.get('/messages', async (req, res) => {
    try {
        const database = await getDb();
        const messages = await database.collection('messages')
            .find({})
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();
        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── POST /api/chat/messages ──────────────────────────────────────────────────
router.post('/messages', async (req, res) => {
    try {
        if (!req.session?.user)
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });

        const { text } = req.body;
        if (!text || text.trim().length === 0)
            return res.status(400).json({ error: 'Mesajul nu poate fi gol.' });

        const message = {
            text: text.trim(),
            username: req.session.user.username,
            userId: req.session.user.id,
            roles: req.session.user.roles,
            timestamp: new Date()
        };

        const database = await getDb();
        await database.collection('messages').insertOne(message);

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.getDb = getDb;