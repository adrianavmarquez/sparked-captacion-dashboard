/// <reference types="vitest/config" />
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** API local. No se empaqueta en el navegador: el import ocurre solo en el servidor de Vite. */
function apiDevPlugin(): Plugin {
  return {
    name: 'sparked-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api')) return next();
        import('./server/dev/node-adapter').then(({ handleNodeRequest }) => handleNodeRequest(req, res)).catch(next);
      });
    },
  };
}

// base './' para que el build funcione abierto desde cualquier carpeta o subruta.
export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  base: './',
  server: { port: 5173, open: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
