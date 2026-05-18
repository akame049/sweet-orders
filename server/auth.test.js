const { describe, it } = require('node:test');
const assert = require('node:assert');

// URL-ul local HTTPS pe care rulează serverul tău
const BACKEND_URL = 'https://localhost:5000';

// Deoarece folosim un certificat local auto-semnat (mkcert),
// îi spunem procesului Node să ignore avertismentele SSL în timpul testului.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('🔒 Teste Automate Native - Autentificare Backend', () => {

    it('❌ Ar trebui să REFUZE logarea dacă parola este greșită', async () => {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'maia.braicu@gmail.com',
                password: 'parola_gresita_de_test'
            })
        });

        // Verificăm dacă serverul întoarce statusul de eroare 401 Unauthorized
        assert.strictEqual(response.status, 401);
    });

    it('✅ Ar trebui să permită logarea cu succes pentru date corecte', async () => {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@sweetorders.com', // Pune un email valid din baza ta de date
                password: 'admin123'               // Parola corectă
            })
        });

        // Verificăm dacă răspunsul este 200 OK
        assert.strictEqual(response.status, 200);

        const data = await response.json();

        // Verificăm dacă obiectul primit conține proprietatea 'user'
        assert.ok(data.user, 'Răspunsul ar trebui să conțină obiectul utilizatorului');
    });
});