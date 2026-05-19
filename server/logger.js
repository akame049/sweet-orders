const { Log, SuspiciousUser } = require('../models');

// Limite pentru detecție
const MAX_ACTIONS_PER_MINUTE = 15;
const MAX_DELETES_PER_MINUTE = 5;
const MAX_CHAT_MESSAGES_PER_MINUTE = 6;
const MAX_LOGIN_ATTEMPTS = 4;

// Cache în memorie
const userActionCache = {};   // { cacheKey: [timestamps] }
const userDeleteCache = {};   // { cacheKey: [timestamps] }
const userChatCache = {};     // { cacheKey: [timestamps] }
const loginFailCache = {};    // { username/email: [timestamps] }

const markSuspicious = async (userId, username, reason, actionCount) => {
    if (!username || username === 'anonim') return;
    try {
        const where = userId ? { userId, resolved: false } : { username, resolved: false };
        const existing = await SuspiciousUser.findOne({ where });
        if (!existing) {
            await SuspiciousUser.create({ userId: userId || null, username, reason, actionCount });
            console.warn(`🚨 USER SUSPECT: ${username} — ${reason}`);
        } else {
            await existing.update({ actionCount, reason });
        }
    } catch (e) {
        console.error('Eroare markSuspicious:', e.message);
    }
};

const checkSuspicious = async (userId, username, method, endpoint, statusCode, body) => {
    const cacheKey = userId || `anon_${username}`;
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // ── 1. Brute Force Login ─────────────────────────────────────────────
    if (endpoint === '/auth/login' && statusCode === 401) {
        const loginKey = body?.email || body?.username || username;
        if (!loginFailCache[loginKey]) loginFailCache[loginKey] = [];
        loginFailCache[loginKey] = loginFailCache[loginKey].filter(t => now - t < oneMinute);
        loginFailCache[loginKey].push(now);

        const attempts = loginFailCache[loginKey].length;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const reason = `Tentativă Brute Force (${attempts} încercări de login într-un minut)`;
            await markSuspicious(userId, loginKey, reason, attempts);
            return reason;
        }
        return null;
    }

    // ── 2. Spam Chat ─────────────────────────────────────────────────────
    if (endpoint.includes('/chat') && method === 'POST') {
        if (!userChatCache[cacheKey]) userChatCache[cacheKey] = [];
        userChatCache[cacheKey] = userChatCache[cacheKey].filter(t => now - t < oneMinute);
        userChatCache[cacheKey].push(now);

        const chatCount = userChatCache[cacheKey].length;
        if (chatCount >= MAX_CHAT_MESSAGES_PER_MINUTE) {
            const reason = `Spam chat (${chatCount} mesaje într-un minut)`;
            await markSuspicious(userId, username, reason, chatCount);
            return reason;
        }
        return null;
    }

    // ── 3. Acțiuni generale (DELETE spam, prea multe acțiuni) ────────────
    if (!userActionCache[cacheKey]) userActionCache[cacheKey] = [];
    if (!userDeleteCache[cacheKey]) userDeleteCache[cacheKey] = [];

    userActionCache[cacheKey] = userActionCache[cacheKey].filter(t => now - t < oneMinute);
    userDeleteCache[cacheKey] = userDeleteCache[cacheKey].filter(t => now - t < oneMinute);

    userActionCache[cacheKey].push(now);
    if (method === 'DELETE') userDeleteCache[cacheKey].push(now);

    const totalActions = userActionCache[cacheKey].length;
    const totalDeletes = userDeleteCache[cacheKey].length;

    if (totalDeletes >= MAX_DELETES_PER_MINUTE) {
        const reason = `${totalDeletes} ștergeri într-un minut`;
        await markSuspicious(userId, username, reason, totalDeletes);
        return reason;
    }
    if (totalActions >= MAX_ACTIONS_PER_MINUTE) {
        const reason = `${totalActions} acțiuni într-un minut`;
        await markSuspicious(userId, username, reason, totalActions);
        return reason;
    }

    return null;
};

const logAction = async (req, res, next) => {
    res.on('finish', async () => {
        if (req.method === 'GET' && !req.path.includes('/logs')) return;

        const user = req.session?.user;
        const userId = user?.id || null;
        const username = user?.username || req.body?.username || req.body?.email || 'anonim';
        const role = user?.roles?.includes('admin') ? 'ADMIN' : 'USER';

        const suspiciousReason = await checkSuspicious(
            userId, username, req.method, req.path, res.statusCode, req.body
        );

        try {
            await Log.create({
                userId,
                username,
                role,
                action: `${req.method} ${req.path} [${res.statusCode}]`,
                method: req.method,
                endpoint: req.path,
                details: JSON.stringify(req.body || {}),
                ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                suspicious: !!suspiciousReason,
                suspiciousReason: suspiciousReason || null
            });
        } catch (e) {
            console.error('Eroare logging:', e.message);
        }
    });

    next();
};

module.exports = { logAction };