import type { Meta, StoryObj } from 'storybook-solidjs';
import { Header } from './Header';
import { Button } from '../../common/Button';

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Header title text',
    },
    variant: {
      control: 'select',
      options: ['default', 'minimal', 'transparent'],
      description: 'Visual style variant',
    },
    sticky: {
      control: 'boolean',
      description: 'Make header sticky on scroll',
    },
    showMenuButton: {
      control: 'boolean',
      description: 'Show mobile menu button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const Logo = () => (
  <div class="flex items-center gap-2">
    <div class="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-bold">
      S
    </div>
    <span class="text-xl font-bold text-primary">Scarlett</span>
  </div>
);

const Actions = () => (
  <>
    <Button variant="ghost" size="sm">
      Songs
    </Button>
    <Button variant="ghost" size="sm">
      Leaderboard
    </Button>
    <Button variant="primary" size="sm">
      Sign In
    </Button>
  </>
);

export const Default: Story = {
  args: {
    logo: () => <Logo />,
    actions: () => <Actions />,
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Scarlett Karaoke',
    actions: () => <Actions />,
  },
};

export const Minimal: Story = {
  args: {
    variant: 'minimal',
    logo: () => <Logo />,
    actions: () => (
      <Button variant="primary" size="sm">
        Start Singing
      </Button>
    ),
  },
};

export const Transparent: Story = {
  args: {
    variant: 'transparent',
    sticky: true,
    logo: () => <Logo />,
    actions: () => <Actions />,
  },
  decorators: [
    (Story) => (
      <div class="min-h-[200vh] bg-gradient-surface">
        <Story />
        <div class="p-8">
          <h2 class="text-2xl font-bold text-primary mb-4">Scroll to see sticky effect</h2>
          <p class="text-secondary">
            The transparent header will blur and add a background when you scroll down.
          </p>
        </div>
      </div>
    ),
  ],
};

export const MobileMenu: Story = {
  args: {
    showMenuButton: true,
    logo: () => <Logo />,
    actions: () => (
      <Button variant="primary" size="sm">
        Sign In
      </Button>
    ),
    onMenuClick: () => alert('Menu clicked!'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const ExtensionHeader: Story = {
  args: {
    variant: 'minimal',
    logo: () => (
      <div class="flex items-center gap-2">
        <div class="text-2xl">🎤</div>
        <span class="text-sm font-medium text-secondary">Scarlett Active</span>
      </div>
    ),
    actions: () => (
      <div class="flex items-center gap-2">
        <button class="p-1.5 rounded hover:bg-highlight transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button class="p-1.5 rounded hover:bg-highlight transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact header for browser extension overlay',
      },
    },
  },
};

export const FarcasterHeader: Story = {
  args: {
    variant: 'minimal',
    logo: () => (
      <div class="flex items-center gap-2">
        <div class="text-xl">🎵</div>
        <span class="text-sm font-semibold text-primary">Karaoke Frame</span>
      </div>
    ),
    actions: () => (
      <div class="flex items-center gap-1">
        <button class="p-2 text-sm text-secondary hover:text-primary transition-colors">
          Share
        </button>
        <button class="p-2 text-sm text-secondary hover:text-primary transition-colors">
          Cast
        </button>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div class="max-w-[424px] mx-auto bg-base">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Minimal header for Farcaster frame (424px constrained)',
      },
    },
  },
};