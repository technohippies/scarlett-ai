module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  ignorePatterns: [
    '.output/**',
    '.wxt/**',
    'node_modules/**',
    'dist/**',
  ],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  globals: {
    chrome: 'readonly',
    HTMLElement: 'readonly',
    __dirname: 'readonly',
  },
  rules: {
    // Extension-specific overrides
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': 'off', // Extensions need console for debugging
    'no-undef': 'off', // TypeScript handles this
  },
};