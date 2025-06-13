import type { StorybookConfig } from '@storybook/html-vite';
import solidPlugin from 'vite-plugin-solid';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  viteFinal: async (config) => {
    config.plugins?.push(solidPlugin());
    
    // Ensure JSON imports are supported for i18n
    config.json = {
      stringify: false
    };
    
    // Ensure proper module resolution
    config.resolve = {
      ...config.resolve,
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    };
    
    return config;
  },
}

export default config