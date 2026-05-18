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
    // Identificăm utilizatorul după ID, dacă e logat, sau după username/email/IP dacă e anonim la login
    const identifier = userId || username || (req && req.ip) || 'anonim';

    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Inițializare cache în memorie dacă nu există
    if (!userActionCache[identifier]) userActionCache[identifier] = [];
    if (!userChatCache[identifier]) userChatCache[identifier] = [];
    if (!loginFailCache[identifier]) loginFailCache[identifier] = [];

    // Curăță intrările mai vechi de 1 minut
    userActionCache[identifier] = userActionCache[identifier].filter(t => now - t < oneMinute);
    userChatCache[identifier] = userChatCache[identifier].filter(t => now - t < oneMinute);
    loginFailCache[identifier] = loginFailCache[identifier].filter(t => now - t < oneMinute);

    // 1. Contorizare acțiuni generale
    userActionCache[identifier].push(now);

    // 2. Regula pentru Spam pe Chat
    if (method === 'POST' && endpoint.includes('/chat')) {
        userChatCache[identifier].push(now);
    }

    // 3. Regula pentru Login repetat (Brute Force)
    // De data asta verificăm direct dacă ruta accesată este de login, indiferent de ce zice statusul
    if (method === 'POST' && endpoint.includes('/login')) {
        loginFailCache[identifier].push(now);
    }

    const totalActions = userActionCache[identifier].length;
    const totalChatMessages = userChatCache[identifier].length;
    const totalLoginAttempts = loginFailCache[identifier].length;

    let suspicious = false;
    let reason = '';

    // Verificăm limitele stabilite de tine
    if (totalLoginAttempts > MAX_LOGIN_ATTEMPTS) { // MAX_LOGIN_ATTEMPTS este 4
        suspicious = true;
        reason = `Tentativă Brute Force (${totalLoginAttempts} încercări de login într-un minut)`;
    } else if (totalChatMessages > MAX_CHAT_MESSAGES_PER_MINUTE) { // MAX_CHAT_MESSAGES_PER_MINUTE este 5
        suspicious = true;
        reason = `Spam pe chat (${totalChatMessages} mesaje într-un minut)`;
    } else if (totalActions >= MAX_ACTIONS_PER_MINUTE) {
        suspicious = true;
        reason = `${totalActions} acțiuni într-un minut`;
    }

    if (suspicious) {
        // ID-ul salvat în tabel: dacă nu avem userId, punem null sau 0 ca să nu crape relația din DB
        const searchId = userId || null;

        const existing = await SuspiciousUser.findOne({ where: { username: identifier, resolved: false } });

        if (!existing) {
            await SuspiciousUser.create({
                userId: searchId,
                username: identifier,
                reason,
                actionCount: totalActions
            });
            console.warn(`🚨 USER SUSPECT DETECTAT: ${identifier} — ${reason}`);
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