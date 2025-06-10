export { I18nProvider, useI18n } from './provider';
export type { Translations, LocaleConfig, LocaleCode } from './types';

// Available locales configuration
export const LOCALES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr' as const,
    dateFormat: 'MM/DD/YYYY',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
  },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr' as const,
    dateFormat: 'YYYY-MM-DD',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
  },
] as const;