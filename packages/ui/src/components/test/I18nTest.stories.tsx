import type { Meta, StoryObj } from '@storybook/html';
import { Component } from 'solid-js';
import { useI18n } from '../../i18n/provider';
import { withI18n } from '../../utils/i18n-story';

const I18nTestComponent: Component = () => {
  const { t, locale, setLocale } = useI18n();
  
  return (
    <div class="p-8 bg-surface rounded-lg max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold mb-4">i18n Test Component</h1>
      
      <div class="space-y-4">
        <div class="p-4 bg-elevated rounded border border-subtle">
          <p class="text-sm text-secondary mb-2">Current Locale:</p>
          <p class="text-lg font-mono">{locale()}</p>
        </div>
        
        <div class="p-4 bg-elevated rounded border border-subtle">
          <p class="text-sm text-secondary mb-2">Translation Tests:</p>
          <ul class="space-y-2 font-mono text-sm">
            <li>common.buttons.start: "{t('common.buttons.start')}"</li>
            <li>common.search.placeholder: "{t('common.search.placeholder')}"</li>
            <li>homepage.hero.title: "{t('homepage.hero.title')}"</li>
            <li>homepage.hero.subtitle: "{t('homepage.hero.subtitle')}"</li>
            <li>homepage.trending: "{t('homepage.trending')}"</li>
          </ul>
        </div>
        
        <div class="p-4 bg-elevated rounded border border-subtle">
          <p class="text-sm text-secondary mb-2">Locale Switcher (Manual):</p>
          <div class="flex gap-2">
            <button 
              onClick={() => setLocale('en')}
              class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
            >
              English
            </button>
            <button 
              onClick={() => setLocale('zh-CN')}
              class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
            >
              中文
            </button>
          </div>
        </div>
        
        <div class="p-4 bg-warning/10 rounded border border-warning/20">
          <p class="text-sm">
            Note: Use the Storybook toolbar (globe icon) to change locale globally.
            The buttons above only change locale within this component instance.
          </p>
        </div>
      </div>
    </div>
  );
};

const meta: Meta = {
  title: 'Test/I18n',
  render: (args, context) => withI18n(I18nTestComponent)(args, context),
  parameters: {
    layout: 'centered',
  }
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};