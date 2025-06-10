import type { Meta, StoryObj } from 'storybook-solidjs';
import { For } from 'solid-js';
import { AppShell } from './AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    maxWidth: {
      control: 'select',
      options: ['100%', '420px', '424px', '768px', '1024px'],
      description: 'Maximum width constraint for content',
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
      description: 'Content padding size',
    },
    showHeader: {
      control: 'boolean',
      description: 'Show header section',
    },
    showFooter: {
      control: 'boolean',
      description: 'Show footer section',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const DemoContent = () => {
  const sections = Array.from({ length: 20 }, (_, i) => i);
  
  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-primary">AppShell Demo</h1>
      <p class="text-secondary">
        This is a demo of the AppShell component with scrollable content.
      </p>
      <For each={sections}>
        {(i) => (
          <div class="p-4 bg-surface border border-subtle rounded-lg hover:bg-elevated hover:border-default transition-all">
            <h3 class="font-semibold text-primary">Section {i + 1}</h3>
            <p class="text-sm text-secondary">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
        )}
      </For>
    </div>
  );
};

const HeaderContent = () => (
  <div class="px-6 py-4 bg-surface border-b border-subtle backdrop-blur-sm">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-primary">Scarlett</h2>
      <button class="px-4 py-2 text-sm bg-gradient-primary text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all glow-primary">
        Sign In
      </button>
    </div>
  </div>
);

const FooterContent = () => (
  <div class="px-6 py-4 bg-surface border-t border-subtle text-center text-sm text-secondary">
    © 2024 Scarlett. All rights reserved.
  </div>
);

export const Default: Story = {
  args: {
    children: () => <DemoContent />,
    showHeader: true,
    showFooter: true,
    headerContent: () => <HeaderContent />,
    footerContent: () => <FooterContent />,
    padding: 'md',
  },
};

export const MobileConstrained: Story = {
  args: {
    maxWidth: '420px',
    children: () => <DemoContent />,
    showHeader: true,
    showFooter: true,
    headerContent: () => <HeaderContent />,
    footerContent: () => <FooterContent />,
    padding: 'md',
  },
  parameters: {
    docs: {
      description: {
        story: 'Mobile-first design with 420px max width constraint',
      },
    },
  },
};

export const FarcasterFrame: Story = {
  args: {
    maxWidth: '424px',
    padding: 'none',
    showHeader: false,
    showFooter: false,
    children: () => (
      <div class="p-4 bg-base min-h-screen">
        <h2 class="text-xl font-bold mb-4 text-primary">Farcaster Frame</h2>
        <p class="text-secondary">
          Optimized for Farcaster's 424px frame constraint with no padding.
        </p>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Farcaster frame layout with exact 424px width and no chrome',
      },
    },
  },
};

export const HeaderOnly: Story = {
  args: {
    children: () => <DemoContent />,
    showHeader: true,
    showFooter: false,
    headerContent: () => <HeaderContent />,
    padding: 'lg',
  },
};

export const NoChrome: Story = {
  args: {
    children: () => <DemoContent />,
    showHeader: false,
    showFooter: false,
    padding: 'none',
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal layout with no header or footer',
      },
    },
  },
};

export const AllPaddingSizes: Story = {
  render: () => {
    return (
      <div class="grid grid-cols-2 gap-4 h-screen p-4 bg-base">
        <div class="border border-subtle rounded overflow-hidden">
          <h3 class="p-2 bg-surface text-sm font-medium text-primary">Padding: none</h3>
          <div class="h-48 overflow-hidden">
            <AppShell padding="none">
              {() => <div class="bg-elevated h-full p-4 text-primary">No padding</div>}
            </AppShell>
          </div>
        </div>
        <div class="border border-subtle rounded overflow-hidden">
          <h3 class="p-2 bg-surface text-sm font-medium text-primary">Padding: sm</h3>
          <div class="h-48 overflow-hidden">
            <AppShell padding="sm">
              {() => <div class="bg-elevated h-full p-4 text-primary">Small padding</div>}
            </AppShell>
          </div>
        </div>
        <div class="border border-subtle rounded overflow-hidden">
          <h3 class="p-2 bg-surface text-sm font-medium text-primary">Padding: md</h3>
          <div class="h-48 overflow-hidden">
            <AppShell padding="md">
              {() => <div class="bg-elevated h-full p-4 text-primary">Medium padding</div>}
            </AppShell>
          </div>
        </div>
        <div class="border border-subtle rounded overflow-hidden">
          <h3 class="p-2 bg-surface text-sm font-medium text-primary">Padding: lg</h3>
          <div class="h-48 overflow-hidden">
            <AppShell padding="lg">
              {() => <div class="bg-elevated h-full p-4 text-primary">Large padding</div>}
            </AppShell>
          </div>
        </div>
      </div>
    );
  },
};