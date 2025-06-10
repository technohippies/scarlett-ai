import type { Meta, StoryObj } from 'storybook-solidjs';
import { KaraokeHeader } from './KaraokeHeader';

const meta: Meta<typeof KaraokeHeader> = {
  title: 'Karaoke/KaraokeHeader',
  component: KaraokeHeader,
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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    songTitle: 'Stronger',
    artist: 'Kanye West',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[424px] mx-auto bg-base">
        {Story()}
      </div>
    ),
  ],
};

export const LongTitle: Story = {
  args: {
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[424px] mx-auto bg-base">
        {Story()}
      </div>
    ),
  ],
};

export const VeryLongTitle: Story = {
  args: {
    songTitle: 'I Want to Hold Your Hand (Live at the Hollywood Bowl)',
    artist: 'The Beatles',
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[424px] mx-auto bg-base">
        {Story()}
      </div>
    ),
  ],
};