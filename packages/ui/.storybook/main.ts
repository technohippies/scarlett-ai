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
    
    // Support dynamic imports for i18n locales
    config.build = {
      ...config.build,
      dynamicImportVarsOptions: {
        include: ['src/i18n/locales/**']
      }
    };
    
    return config;
  },
}

export default config