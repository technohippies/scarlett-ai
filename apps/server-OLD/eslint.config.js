import baseConfig from '@scarlett/eslint-config';

export default [
  // Global ignores - must be first
  {
    ignores: [
      '.wrangler/**/*',
      'dist/**/*',
      'node_modules/**/*',
      '.turbo/**/*'
    ],
  },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        // Cloudflare Workers globals
        addEventListener: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
      },
    },
    rules: {
      // Server-specific rules
      'no-unused-vars': 'off', // Use TypeScript version instead
    },
  },
]; 