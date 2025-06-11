import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import solid from 'vite-plugin-solid';

export default defineConfig({
  vite: () => ({
    plugins: [solid({ ssr: false })],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@scarlett/ui': resolve(__dirname, '../../packages/ui/src'),
      },
    },
    optimizeDeps: {
      include: ['solid-js', 'solid-js/web', 'solid-js/store'],
    },
    define: {
      global: 'globalThis',
      'process.env': {},
    },
  }),
  manifest: {
    name: 'Scarlett - AI Karaoke Learning',
    description: 'AI-powered karaoke learning extension for language improvement',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'webNavigation',
    ],
    host_permissions: [
      '*://soundcloud.com/*',
      '*://soundcloak.com/*',
      '*://sc.maid.zone/*',
      'http://localhost:*/*',
      'https://localhost:*/*',
    ],
  },
  webExt: {
    startUrls: ['https://sc.maid.zone/kanyewest/stronger'],
  },
});