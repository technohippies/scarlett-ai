import { I18nProvider } from '../i18n';
import type { LocaleCode } from '../i18n';
import { render } from 'solid-js/web';

/**
 * Wraps a component with I18nProvider for Storybook stories
 * Use this when your component needs i18n context
 */
export const withI18n = <T extends Record<string, any>>(Component: any) => {
  return (args: T, context?: any) => {
    const locale = (context?.globals?.locale as LocaleCode) || 'en';
    
    const container = document.createElement('div');
    render(() => (
      <I18nProvider defaultLocale={locale}>
        <Component {...args} />
      </I18nProvider>
    ), container);
    
    return container;
  };
};