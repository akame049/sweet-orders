import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Aceasta este singura declaratie de export default permisa
export default defineConfig({
    plugins: [react()],
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