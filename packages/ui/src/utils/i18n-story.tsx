import { I18nProvider } from '../i18n';
import type { LocaleCode } from '../i18n';
import { solidStory } from './storybook';

/**
 * Wraps a component with I18nProvider for Storybook stories
 * Use this when your component needs i18n context
 */
export const withI18n = <T extends Record<string, any>>(Component: any) => {
  return (props: T, context?: any) => {
    const locale = (context?.globals?.locale as LocaleCode) || 'en';
    
    const WrappedComponent = () => (
      <I18nProvider defaultLocale={locale}>
        <Component {...props} />
      </I18nProvider>
    );
    
    return solidStory(WrappedComponent)(props);
  };
};