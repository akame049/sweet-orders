const request = require('supertest');

// Înlocuiește cu URL-ul local pe care rulează serverul tău în mod normal
const BACKEND_URL = 'https://localhost:5000';

describe('🔒 Teste Automate - Autentificare Backend', () => {

    it('❌ Ar trebui să REFUZE logarea dacă parola este greșită', async () => {
        const response = await request(BACKEND_URL)
            .post('/api/auth/login')
            .send({
                email: 'maia.braicu@gmail.com',
                password: 'parola_gresita_de_test'
            });

        // Verificăm dacă serverul întoarce statusul de eroare 401
        expect(response.statusCode).toEqual(401);
    });

    it('✅ Ar trebui să permită logarea cu succes pentru date corecte', async () => {
        const response = await request(BACKEND_URL)
            .post('/api/auth/login')
            .send({
                email: 'admin@sweetorders.com', // Pune un cont valid din DB-ul tău
                password: 'admin'
            });

        // Verificăm dacă răspunsul este 200 OK
        expect(response.statusCode).toEqual(200);
        // Verificăm dacă serverul ne trimite înapoi obiectul utilizatorului
        expect(response.body).toHaveProperty('user');
    });
});