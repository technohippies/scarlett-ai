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
    return config;
  },
}

export default config