import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        JWT_SECRET: 'test-secret-key-for-testing-only',
        ENVIRONMENT: 'test',
      },
      kvNamespaces: ['TEST_KV'],
      d1Databases: ['__D1_BETA__DB'],
    },
    include: ['**/*.integration.test.ts'],
    setupFiles: ['./src/test/setup.integration.ts'],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});