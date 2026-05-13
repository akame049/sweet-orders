'use strict';

const express = require('express');
const router = express.Router();
const { User, Role, Permission } = require('../models');

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password)
            return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii.' });
        if (password.length < 6)
            return res.status(400).json({ error: 'Parola trebuie să aibă minim 6 caractere.' });

        const existing = await User.findOne({ where: { email } });
        if (existing)
            return res.status(400).json({ error: 'Email-ul este deja folosit.' });

        const user = await User.create({ username, email, password });

        // Asignăm rolul de 'user' by default
        const userRole = await Role.findOne({ where: { name: 'user' } });
        if (userRole) await user.addRole(userRole);

        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: ['user']
        };

        // Stocăm în sesiune
        req.session.user = userData;

        res.status(201).json({ message: 'Cont creat cu succes!', user: userData });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Username-ul sau email-ul există deja.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: 'Email și parolă obligatorii.' });

        const user = await User.findOne({
            where: { email },
            include: [{
                model: Role,
                as: 'roles',
                include: [{ model: Permission, as: 'permissions' }]
            }]
        });

        if (!user)
            return res.status(401).json({ error: 'Email sau parolă incorectă.' });

        const valid = await user.validatePassword(password);
        if (!valid)
            return res.status(401).json({ error: 'Email sau parolă incorectă.' });

        const roles = user.roles.map(r => r.name);
        const permissions = [...new Set(user.roles.flatMap(r => r.permissions.map(p => p.name)))];

        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            roles,
            permissions
        };

        req.session.user = userData;

        res.json({ message: 'Login reușit!', user: userData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout reușit.' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ error: 'Neautentificat.' });
    res.json(req.session.user);
});

module.exports = router;