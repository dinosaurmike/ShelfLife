import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: './',
  base: './',
  server: {
    port: 8000,
    open: false,
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        analytics: path.resolve(__dirname, 'analytics.html'),
        laseroutput: path.resolve(__dirname, 'laseroutput.html'),
        tree: path.resolve(__dirname, 'reading_tree.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
