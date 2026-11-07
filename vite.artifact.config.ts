import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build de UN solo archivo HTML (JS, CSS e imágenes incrustados) para publicarlo como artifact de claude.ai.
// npm run build:artifact → dist-artifact/index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  define: { 'import.meta.env.VITE_ROUTER': JSON.stringify('memory') },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
