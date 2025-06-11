import type { Meta, StoryObj } from '@storybook/html';
import { LyricsDisplay, type LyricsDisplayProps } from './LyricsDisplay';
import { solidStory } from '../../../utils/storybook';

const mockLyrics = [
  { id: '1', text: "Never gonna give you up", startTime: 0, duration: 3000 },
  { id: '2', text: "Never gonna let you down", startTime: 3, duration: 3000 },
  { id: '3', text: "Never gonna run around and desert you", startTime: 6, duration: 4000 },
  { id: '4', text: "Never gonna make you cry", startTime: 10, duration: 3000 },
  { id: '5', text: "Never gonna say goodbye", startTime: 13, duration: 3000 },
  { id: '6', text: "Never gonna tell a lie and hurt you", startTime: 16, duration: 4000 },
];

const meta: Meta<LyricsDisplayProps> = {
  title: 'Karaoke/LyricsDisplay',
  render: solidStory(LyricsDisplay),
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      const StoryComponent = () => (
        <div class="bg-base h-screen p-8">
          <div class="max-w-2xl mx-auto h-full bg-surface rounded-lg overflow-hidden">
            <Story />
          </div>
        </div>
      );
      return solidStory(StoryComponent)({});
    },
  ],
  argTypes: {
    currentTime: {
      control: { type: 'range', min: 0, max: 20000, step: 100 },
      description: 'Current playback time in milliseconds',
    },
    isPlaying: {
      control: 'boolean',
      description: 'Whether the karaoke is playing',
    },
  },
};

export default meta;
type Story = StoryObj<LyricsDisplayProps>;

export const Idle: Story = {
  args: {
    lyrics: mockLyrics,
    currentTime: 0,
    isPlaying: false,
  },
};

export const Playing: Story = {
  args: {
    lyrics: mockLyrics,
    currentTime: 7000, // This stays in milliseconds as per the component API
    isPlaying: true,
  },
};

export const EmptyState: Story = {
  args: {
    lyrics: [],
    currentTime: 0,
    isPlaying: false,
  },
};