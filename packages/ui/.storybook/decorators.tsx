import { I18nProvider } from '../src/i18n';
import type { LocaleCode } from '../src/i18n';
import { solidStory } from '../src/utils/storybook';

export const withI18nDecorator = (Story: any, context: any) => {
  const locale = (context.globals.locale as LocaleCode) || 'en';
  
  // Check if this is already an HTML story (returns HTMLElement)
  const storyResult = Story();
  
  if (storyResult instanceof HTMLElement || storyResult instanceof DocumentFragment) {
    // Story already returns DOM - just return it
    return storyResult;
  }
  
  // Otherwise, wrap in I18nProvider and render with solidStory
  const WrappedStory = () => (
    <I18nProvider defaultLocale={locale}>
      {typeof storyResult === 'function' ? storyResult() : storyResult}
    </I18nProvider>
  );
  
  return solidStory(WrappedStory)();
};