import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    plugins: [react()],

    // Configurația pentru ca Vite să ruleze securizat pe HTTPS în rețeaua locală
    server: {
        host: '0.0.0.0', // Permite telefonului să se conecteze la laptop
        port: 5173,
        https: {
            // Mergem în folderul 'server' ca să citim certificatele tale existente
            key: fs.readFileSync(path.resolve(__dirname, 'server', 'server.key')),
            cert: fs.readFileSync(path.resolve(__dirname, 'server', 'server.cert')),
        }
    },

    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.js'],
        exclude: ['**/node_modules/**', '**/tests-e2e/**', '**/*.spec.js'],
        deps: {
            inline: ['react-cookie']
        }
    },
});