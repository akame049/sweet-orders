const { Log, SuspiciousUser } = require('../models');

// Limite pentru detecție rapidă
const MAX_ACTIONS_PER_MINUTE = 15;
const MAX_CHAT_MESSAGES_PER_MINUTE = 5; // Peste 5 mesaje pe chat = Spam!
const MAX_LOGIN_ATTEMPTS = 4; // Peste 4 încercări eșuate = Brute Force!

// Cache în memorie pentru contoare
const userActionCache = {};     // { userId: [timestamps] }
const userChatCache = {};       // { userId: [timestamps] }
const loginFailCache = {};      // { ip_sau_username: [timestamps] }

const checkSuspicious = async (userId, username, method, endpoint, res, req) => {
    // Dacă e vizitator anonim și nu e pe login, nu avem ce număra per user
    if (!userId && !endpoint.includes('/login')) return null;

    const now = Date.now();
    const oneMinute = 60 * 1000;
    const identifier = userId || username || req.ip;

    // Inițializare cache globale
    if (!userActionCache[identifier]) userActionCache[identifier] = [];
    if (!userChatCache[identifier]) userChatCache[identifier] = [];
    if (!loginFailCache[identifier]) loginFailCache[identifier] = [];

    // Curăță intrările mai vechi de 1 minut
    userActionCache[identifier] = userActionCache[identifier].filter(t => now - t < oneMinute);
    userChatCache[identifier] = userChatCache[identifier].filter(t => now - t < oneMinute);
    loginFailCache[identifier] = loginFailCache[identifier].filter(t => now - t < oneMinute);

    // 1. Contorizare acțiuni generale globale
    userActionCache[identifier].push(now);

    // 2. Contorizare mesaje CHAT (Dacă trimite POST pe chat)
    if (method === 'POST' && endpoint.includes('/chat')) {
        userChatCache[identifier].push(now);
    }

    // 3. Contorizare Login Eșuat (Prindem când res.statusCode devine 401 la finalul cererii)
    if (endpoint.includes('/login') && res.statusCode === 401) {
        loginFailCache[identifier].push(now);
    }

    const totalActions = userActionCache[identifier].length;
    const totalChatMessages = userChatCache[identifier].length;
    const totalLoginFailures = loginFailCache[identifier].length;

    let suspicious = false;
    let reason = '';

    // Aplicarea regulilor tale
    if (totalLoginFailures > MAX_LOGIN_ATTEMPTS) {
        suspicious = true;
        reason = `Tentativă Brute Force (${totalLoginFailures} parole greșite)`;
    } else if (totalChatMessages > MAX_CHAT_MESSAGES_PER_MINUTE) {
        suspicious = true;
        reason = `Spam pe chat (${totalChatMessages} mesaje într-un minut)`;
    } else if (totalActions >= MAX_ACTIONS_PER_MINUTE) {
        suspicious = true;
        reason = `${totalActions} acțiuni într-un minut`;
    }

    if (suspicious) {
        // Căutăm dacă userul e deja marcat în DB ca nerezolvat
        // Folosim un ID valid sau 0 pentru tentative de brute force anonime
        const searchId = userId || 0;
        const existing = await SuspiciousUser.findOne({ where: { userId: searchId, resolved: false } });

        if (!existing) {
            await SuspiciousUser.create({
                userId: searchId,
                username: username || 'anonim_bruteforce',
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