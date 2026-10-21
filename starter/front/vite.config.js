import { defineConfig } from 'vite';

// En développement, le navigateur appelle /api/... sur le serveur Vite (port 5173).
// Le "proxy" redirige ces appels vers l'API (port 3000) : pas de problème de CORS.
const apiUrl = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': apiUrl,
      '/health': apiUrl,
    },
  },
  test: {
    environment: 'node',
  },
});
