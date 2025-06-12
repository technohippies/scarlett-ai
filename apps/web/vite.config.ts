import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3001,
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@scarlett/ui': path.resolve(__dirname, '../../packages/ui'),
    },
  },
  optimizeDeps: {
    include: ['solid-js'],
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});