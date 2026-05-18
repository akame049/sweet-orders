const { Log, SuspiciousUser } = require('../models');

// Acțiuni considerate sensibile
const SENSITIVE_ACTIONS = ['DELETE', 'PUT', 'POST'];
const MAX_ACTIONS_PER_MINUTE = 15; // mai mult = suspect
const MAX_DELETES_PER_MINUTE = 5;

// Cache în memorie pentru detecție rapidă
const userActionCache = {}; // { userId: [timestamps] }
const userDeleteCache = {}; // { userId: [timestamps] }

const checkSuspicious = async (userId, username, method, endpoint) => {
    if (!userId) return;

    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Inițializează cache
    if (!userActionCache[userId]) userActionCache[userId] = [];
    if (!userDeleteCache[userId]) userDeleteCache[userId] = [];

    // Curăță acțiunile mai vechi de 1 minut
    userActionCache[userId] = userActionCache[userId].filter(t => now - t < oneMinute);
    userDeleteCache[userId] = userDeleteCache[userId].filter(t => now - t < oneMinute);

    // Adaugă acțiunea curentă
    userActionCache[userId].push(now);
    if (method === 'DELETE') userDeleteCache[userId].push(now);

    const totalActions = userActionCache[userId].length;
    const totalDeletes = userDeleteCache[userId].length;

    let suspicious = false;
    let reason = '';

    if (totalDeletes >= MAX_DELETES_PER_MINUTE) {
        suspicious = true;
        reason = `${totalDeletes} ștergeri într-un minut`;
    } else if (totalActions >= MAX_ACTIONS_PER_MINUTE) {
        suspicious = true;
        reason = `${totalActions} acțiuni într-un minut`;
    }

    if (suspicious) {
        // Verifică dacă userul e deja în lista de suspecți
        const existing = await SuspiciousUser.findOne({ where: { userId, resolved: false } });
        if (!existing) {
            await SuspiciousUser.create({ userId, username, reason, actionCount: totalActions });
            console.warn(`🚨 USER SUSPECT: ${username} — ${reason}`);
        } else {
            await existing.update({ actionCount: totalActions, reason });
        }
    }

    return suspicious ? reason : null;
};

const logAction = async (req, res, next) => {
    // Sărim rutele de GET normale și health checks
    if (req.method === 'GET' && !req.path.includes('/logs')) return next();

    const user = req.session?.user;
    const userId = user?.id || null;
    const username = user?.username || 'anonim';
    const role = user?.roles?.includes('admin') ? 'ADMIN' : 'USER';

    const suspiciousReason = await checkSuspicious(userId, username, req.method, req.path);

    try {
        await Log.create({
            userId,
            username,
            role,
            action: `${req.method} ${req.path}`,
            method: req.method,
            endpoint: req.path,
            details: JSON.stringify(req.body || {}),
            ip: req.ip || req.headers['x-forwarded-for'],
            suspicious: !!suspiciousReason,
            suspiciousReason: suspiciousReason || null
        });
    } catch (e) {
        console.error('Eroare logging:', e.message);
    }

    next();
};

module.exports = { logAction };