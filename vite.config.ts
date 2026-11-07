import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para que el build funcione abierto desde cualquier carpeta o subruta.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, open: false },
});
