import type { Meta, StoryObj } from '@storybook/html';
import { Footer, type FooterProps } from './Footer';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<FooterProps> = {
  title: 'Layout/Footer',
  render: solidStory(Footer),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'minimal', 'centered'],
      description: 'Footer layout variant',
    },
    copyright: {
      control: 'text',
      description: 'Copyright text',
    },
  },
};

export default meta;
type Story = StoryObj<FooterProps>;

const footerSections = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#' },
      { label: 'Pricing', href: '#' },
      { label: 'Extension', href: '#' },
      { label: 'Mobile App', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Song Library', href: '#' },
      { label: 'Tutorials', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Support', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'License', href: '#' },
      { label: 'DMCA', href: '#' },
    ],
  },
];

const SocialLinks = () => (
  <>
    <a href="#" class="text-secondary hover:text-primary transition-colors">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
      </svg>
    </a>
    <a href="#" class="text-secondary hover:text-primary transition-colors">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>
    <a href="#" class="text-secondary hover:text-primary transition-colors">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
      </svg>
    </a>
  </>
);

export const Default: Story = {
  args: {
    sections: footerSections,
  },
};

export const Minimal: Story = {
  args: {
    variant: 'minimal',
    bottomContent: () => (
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-sm text-secondary">
          Made with 🎤 by the Scarlett team
        </div>
        <div class="flex gap-4 text-sm">
          <a href="#" class="text-secondary hover:text-primary transition-colors">Privacy</a>
          <a href="#" class="text-secondary hover:text-primary transition-colors">Terms</a>
          <a href="#" class="text-secondary hover:text-primary transition-colors">Support</a>
        </div>
      </div>
    ),
  },
};

export const Centered: Story = {
  args: {
    variant: 'centered',
    socialLinks: () => <SocialLinks />,
    copyright: '© 2024 Scarlett Karaoke. Sing your heart out! 🎵',
  },
};

export const ExtensionFooter: Story = {
  args: {
    variant: 'minimal',
    copyright: false,
    bottomContent: () => (
      <div class="flex items-center justify-between text-xs">
        <span class="text-muted">v1.2.3</span>
        <div class="flex gap-3">
          <a href="#" class="text-secondary hover:text-primary transition-colors">Settings</a>
          <a href="#" class="text-secondary hover:text-primary transition-colors">Help</a>
        </div>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact footer for browser extension',
      },
    },
  },
};

export const WebAppFooter: Story = {
  args: {
    sections: footerSections,
    socialLinks: () => <SocialLinks />,
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'min-h-screen bg-base flex flex-col';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'flex-1 p-8';
      contentDiv.innerHTML = '<h1 class="text-2xl font-bold text-primary mb-4">Main Content</h1><p class="text-secondary">The footer stays at the bottom of the page.</p>';
      container.appendChild(contentDiv);
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML += storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const FarcasterFooter: Story = {
  args: {
    variant: 'minimal',
    copyright: false,
    bottomContent: () => (
      <div class="text-center py-2">
        <div class="text-xs text-muted">
          Powered by Scarlett • <a href="#" class="text-accent hover:underline">Cast your score</a>
        </div>
      </div>
    ),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'max-w-[424px] mx-auto bg-base min-h-[600px] flex flex-col';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'flex-1 p-4';
      contentDiv.innerHTML = '<h2 class="text-lg font-bold text-primary">Farcaster Frame Content</h2>';
      container.appendChild(contentDiv);
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML += storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Minimal footer for Farcaster frame (424px constrained)',
      },
    },
  },
};