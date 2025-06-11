import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3001,
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['solid-js', '@scarlett/ui'],
    exclude: ['@scarlett/ui/src/styles/globals.css'],
  },
});