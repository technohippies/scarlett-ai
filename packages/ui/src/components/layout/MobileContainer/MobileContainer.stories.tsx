import type { Meta, StoryObj } from '@storybook/html';
import { For } from 'solid-js';
import { MobileContainer, type MobileContainerProps } from './MobileContainer';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<MobileContainerProps> = {
  title: 'Layout/MobileContainer',
  render: solidStory(MobileContainer),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    maxWidth: {
      control: 'select',
      options: ['375px', '390px', '420px', '424px'],
      description: 'Maximum width for mobile viewport',
    },
    safeArea: {
      control: 'boolean',
      description: 'Enable safe area insets for notched devices',
    },
    centerContent: {
      control: 'boolean',
      description: 'Center content vertically and horizontally',
    },
    backgroundColor: {
      control: 'color',
      description: 'Background color of the container',
    },
  },
};

export default meta;
type Story = StoryObj<MobileContainerProps>;

const MobileContent = () => {
  return (
    <div class="p-6 space-y-4">
      <h1 class="text-2xl font-bold text-primary">Mobile Container</h1>
      <p class="text-secondary">
        This container is optimized for mobile viewports with touch gestures and safe area support.
      </p>
      <div class="grid grid-cols-2 gap-4">
        <For each={[0, 1, 2, 3, 4, 5]}>
          {(i) => (
            <div class="bg-surface border border-subtle p-4 rounded-lg text-center hover:bg-elevated transition-all">
              <div class="text-3xl mb-2">🎤</div>
              <p class="text-sm text-secondary">Track {i + 1}</p>
            </div>
          )}
        </For>
      </div>
      <button class="w-full py-3 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all glow-primary">
        Start Singing
      </button>
    </div>
  );
};

export const Default: Story = {
  args: {
    children: <MobileContent />,
    safeArea: true,
  },
};

export const MobileWeb: Story = {
  args: {
    children: <MobileContent />,
    maxWidth: '420px',
    safeArea: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Mobile web app width (420px) with safe area insets',
      },
    },
  },
};

export const FarcasterFrame: Story = {
  args: {
    maxWidth: '424px',
    safeArea: false,
    children: (
      <div class="bg-base text-white p-6 min-h-screen">
        <h2 class="text-xl font-bold mb-4 text-primary">Farcaster Frame</h2>
        <p class="mb-6 text-secondary">Exact 424px width for Farcaster compatibility</p>
        <div class="space-y-3">
          <div class="bg-surface border border-subtle p-4 rounded-lg hover:border-default transition-all">
            <p class="font-medium text-primary">🎵 Current Song</p>
          </div>
          <div class="bg-surface border border-subtle p-4 rounded-lg hover:border-default transition-all">
            <p class="font-medium text-primary">🏆 Leaderboard</p>
          </div>
          <div class="bg-gradient-primary p-4 rounded-lg glow-primary">
            <p class="font-medium text-white">🎤 Start Karaoke</p>
          </div>
        </div>
      </div>
    ),
  },
};

export const CenteredContent: Story = {
  args: {
    centerContent: true,
    children: (
      <div class="text-center p-8">
        <div class="text-6xl mb-4 animate-pulse">🎤</div>
        <h2 class="text-2xl font-bold mb-2 text-primary">Ready to Sing?</h2>
        <p class="text-secondary mb-6">Start your karaoke session</p>
        <button class="px-8 py-3 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all glow-primary">
          Start Now
        </button>
      </div>
    ),
  },
};

const ScrollableList = () => {
  const sections = Array.from({ length: 20 }, (_, i) => i);
  const genres = ['Pop', 'Rock', 'R&B', 'Hip Hop', 'Country', 'EDM'];
  
  return (
    <div class="p-6">
      <h2 class="text-xl font-bold mb-4 sticky top-0 bg-base py-2 text-primary backdrop-blur-sm">
        Your Karaoke History
      </h2>
      <For each={sections}>
        {(i) => (
          <div class="mb-4 p-4 bg-surface border border-subtle rounded-lg hover:bg-elevated hover:border-default transition-all">
            <h3 class="font-medium text-primary">Song {i + 1}</h3>
            <p class="text-sm text-secondary">
              {genres[i % genres.length]} • Score: {85 + (i % 15)}/100
            </p>
          </div>
        )}
      </For>
    </div>
  );
};

export const ScrollableContent: Story = {
  args: {
    children: <ScrollableList />,
    maxWidth: '420px',
    safeArea: true,
  },
};

export const WithNotch: Story = {
  render: () => solidStory(() => (
    <div class="relative bg-black p-4 rounded-[3rem] mx-auto" style="width: 375px;">
      {/* Notch simulation */}
      <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-black rounded-b-2xl z-10" />
      
      <div class="bg-surface rounded-[2.5rem] overflow-hidden">
        <MobileContainer safeArea={true} maxWidth="375px">
          <div class="bg-gradient-surface text-white p-6 min-h-[600px]">
            <div class="pt-8">
              <h2 class="text-xl font-bold mb-4 text-primary">Safe Area Demo</h2>
              <p class="mb-4 text-secondary">
                This container respects the notch and home indicator areas.
              </p>
              <div class="bg-surface border border-subtle p-4 rounded-lg">
                <p class="text-secondary">Content is safely positioned away from system UI</p>
              </div>
            </div>
          </div>
        </MobileContainer>
      </div>

      {/* Home indicator */}
      <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-400 rounded-full" />
    </div>
  ))({}),
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of safe area handling for devices with notches',
      },
    },
  },
};