import { createContext, useContext, createSignal, createEffect, createMemo } from 'solid-js';
import type { ParentComponent } from 'solid-js';
import type { Translations, LocaleCode } from './types';

interface I18nContextValue {
  locale: () => LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, params?: Record<string, any>) => string;
  dir: () => 'ltr' | 'rtl';
  formatNumber: (num: number) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue>();

export const I18nProvider: ParentComponent<{ defaultLocale?: LocaleCode }> = (props) => {
  const [locale, setLocale] = createSignal<LocaleCode>(props.defaultLocale || 'en');
  const [translations, setTranslations] = createSignal<Translations>();
  
  console.log('[I18nProvider] Initializing with locale:', props.defaultLocale || 'en');
  console.log('[I18nProvider] Browser language:', navigator.language);
  console.log('[I18nProvider] Browser languages:', navigator.languages);
  
  // Load translations dynamically
  createEffect(async () => {
    const currentLocale = locale();
    console.log('[I18nProvider] Loading translations for locale:', currentLocale);
    try {
      const module = await import(`./locales/${currentLocale}/index.ts`);
      setTranslations(module.default);
      console.log('[I18nProvider] Successfully loaded translations for:', currentLocale);
      console.log('[I18nProvider] Available translation keys:', Object.keys(module.default));
    } catch (e) {
      console.error(`[I18nProvider] Failed to load locale ${currentLocale}:`, e);
      console.warn(`[I18nProvider] Falling back to English`);
      const module = await import('./locales/en/index.ts');
      setTranslations(module.default);
      console.log('[I18nProvider] Loaded fallback English translations');
    }
  });

  // Deep key access with dot notation
  const t = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.');
    let value: any = translations();
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    // Log translation lookups for debugging
    if (!value) {
      console.warn(`[I18nProvider] Missing translation for key: ${key} in locale: ${locale()}`);
    }
    
    // Handle parameter replacement
    if (typeof value === 'string' && params) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] || ''));
    }
    
    return value || key;
  };

  // Direction (for RTL languages in future)
  const dir = (): 'ltr' | 'rtl' => 'ltr'; // Only LTR languages supported currently

  // Number formatting
  const numberFormatter = createMemo(() => 
    new Intl.NumberFormat(locale())
  );

  const formatNumber = (num: number) => numberFormatter().format(num);

  // Date formatting
  const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(locale(), options).format(date);
  };

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    dir,
    formatNumber,
    formatDate,
  };

  return (
    <I18nContext.Provider value={value}>
      {props.children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};