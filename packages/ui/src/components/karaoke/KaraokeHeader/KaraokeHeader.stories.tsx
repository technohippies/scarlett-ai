import type { Meta, StoryObj } from '@storybook/html';
import { KaraokeHeader, type KaraokeHeaderProps } from './KaraokeHeader';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<KaraokeHeaderProps> = {
  title: 'Karaoke/KaraokeHeader',
  render: solidStory(KaraokeHeader),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    songTitle: {
      control: 'text',
      description: 'Song title',
    },
    artist: {
      control: 'text',
      description: 'Artist name',
    },
  },
};

export default meta;
type Story = StoryObj<KaraokeHeaderProps>;

export const Default: Story = {
  args: {
    songTitle: 'Stronger',
    artist: 'Kanye West',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[424px] mx-auto bg-base';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const LongTitle: Story = {
  args: {
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[424px] mx-auto bg-base';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const VeryLongTitle: Story = {
  args: {
    songTitle: 'I Want to Hold Your Hand (Live at the Hollywood Bowl)',
    artist: 'The Beatles',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[424px] mx-auto bg-base';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};