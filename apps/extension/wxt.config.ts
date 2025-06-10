import path from 'node:path';
import { defineConfig } from 'wxt';
import solid from 'vite-plugin-solid';

export default defineConfig({
  vite: () => ({
    plugins: [solid({ ssr: false })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@scarlett/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
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
    startUrls: ['https://sc.maid.zone/beyonce/beyonce-amen'],
  },
});