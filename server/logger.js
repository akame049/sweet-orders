const { Log, SuspiciousUser } = require('../models');

// Limite pentru detecție rapidă
const MAX_ACTIONS_PER_MINUTE = 15;
const MAX_CHAT_MESSAGES_PER_MINUTE = 5; // Peste 5 mesaje pe chat = Spam!
const MAX_LOGIN_ATTEMPTS = 4; // Peste 4 încercări eșuate = Brute Force!

// Cache în memorie pentru contoare
const userActionCache = {};     // { userId: [timestamps] }
const userChatCache = {};       // { userId: [timestamps] }
const loginFailCache = {};      // { ip_sau_username: [timestamps] }

const checkSuspicious = async (userId, username, method, endpoint) => {
    // Folosim userId sau username ca cheie de cache
    const cacheKey = userId || `anon_${username}`;
    if (!cacheKey) return;

    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (!userActionCache[cacheKey]) userActionCache[cacheKey] = [];
    if (!userDeleteCache[cacheKey]) userDeleteCache[cacheKey] = [];

    userActionCache[cacheKey] = userActionCache[cacheKey].filter(t => now - t < oneMinute);
    userDeleteCache[cacheKey] = userDeleteCache[cacheKey].filter(t => now - t < oneMinute);

    userActionCache[cacheKey].push(now);
    if (method === 'DELETE') userDeleteCache[cacheKey].push(now);

    const totalActions = userActionCache[cacheKey].length;
    const totalDeletes = userDeleteCache[cacheKey].length;

    let suspicious = false;
    let reason = '';

    if (totalDeletes >= MAX_DELETES_PER_MINUTE) {
        suspicious = true;
        reason = `${totalDeletes} ștergeri într-un minut`;
    } else if (totalActions >= MAX_ACTIONS_PER_MINUTE) {
        suspicious = true;
        reason = `${totalActions} acțiuni într-un minut`;
    }

    if (suspicious && username && username !== 'anonim') {
        const where = userId ? { userId, resolved: false } : { username, resolved: false };
        const existing = await SuspiciousUser.findOne({ where });
        if (!existing) {
            await SuspiciousUser.create({
                userId: userId || null,  // null e ok acum
                username,
                reason,
                actionCount: totalActions
            });
            console.warn(`🚨 USER SUSPECT: ${username} — ${reason}`);
        } else {
            await existing.update({ actionCount: totalActions, reason });
        }
    }

    return suspicious ? reason : null;
};

const logAction = async (req, res, next) => {
    // Așteptăm ca restul rutei de Express să se execute (login-ul să verifice parola, chatul să trimită mesajul)
    // Folosim res.on('finish') ca să știm exact dacă login-ul a eșuat (401) sau a reușit (200)
    res.on('finish', async () => {
        // Sărim peste rutele simple de GET (în afară de loguri)
        if (req.method === 'GET' && !req.path.includes('/logs')) return;

        const user = req.session?.user;
        const userId = user?.id || null;
        const username = user?.username || req.body?.username || req.body?.email || 'anonim';
        const role = user?.roles?.includes('admin') ? 'ADMIN' : 'USER';

        const suspiciousReason = await checkSuspicious(userId, username, req.method, req.path, res, req);

        try {
            await Log.create({
                userId,
                username,
                role,
                action: `${req.method} ${req.path} [Status: ${res.statusCode}]`,
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