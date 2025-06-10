import type { Meta, StoryObj } from '@storybook/html';
import { ExtensionKaraokeView, type ExtensionKaraokeViewProps } from './ExtensionKaraokeView';
import type { LyricLine } from '../LyricsDisplay';
import type { LeaderboardEntry } from '../LeaderboardPanel';
import type { PlaybackSpeed } from '../../common/SplitButton';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<ExtensionKaraokeViewProps> = {
  title: 'Karaoke/ExtensionKaraokeView',
  render: solidStory(ExtensionKaraokeView),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    score: {
      control: 'number',
      description: 'User score',
    },
    rank: {
      control: 'number',
      description: 'User rank',
    },
    currentTime: {
      control: { type: 'range', min: 0, max: 180, step: 0.1 },
      description: 'Current playback time in seconds',
    },
    isPlaying: {
      control: 'boolean',
      description: 'Whether the karaoke is currently playing',
    },
  },
};

export default meta;
type Story = StoryObj<ExtensionKaraokeViewProps>;

const sampleLyrics: LyricLine[] = [
  { id: '1', text: "Is this the real life?", startTime: 0, duration: 3 },
  { id: '2', text: "Is this just fantasy?", startTime: 3, duration: 3 },
  { id: '3', text: "Caught in a landslide", startTime: 6, duration: 3 },
  { id: '4', text: "No escape from reality", startTime: 9, duration: 4 },
  { id: '5', text: "Open your eyes", startTime: 13, duration: 3 },
  { id: '6', text: "Look up to the skies and see", startTime: 16, duration: 5 },
  { id: '7', text: "I'm just a poor boy", startTime: 21, duration: 3 },
  { id: '8', text: "I need no sympathy", startTime: 24, duration: 3 },
];

const sampleLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: 'KaraokeKing', score: 12500 },
  { rank: 2, username: 'SongBird92', score: 11200 },
  { rank: 3, username: 'MelodyMaster', score: 10800 },
  { rank: 4, username: 'CurrentUser', score: 8750, isCurrentUser: true },
  { rank: 5, username: 'VocalVirtuoso', score: 8200 },
];

export const Default: Story = {
  args: {
    score: 8750,
    rank: 4,
    lyrics: sampleLyrics,
    leaderboard: sampleLeaderboard,
    currentTime: 12,
    isPlaying: true,
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed: PlaybackSpeed) => console.log('Speed changed to:', speed),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'h-screen w-screen bg-base';
      
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

export const NotPlaying: Story = {
  args: {
    score: 8750,
    rank: 4,
    lyrics: sampleLyrics,
    leaderboard: sampleLeaderboard,
    currentTime: 5,
    isPlaying: false,
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed: PlaybackSpeed) => console.log('Speed changed to:', speed),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'h-screen w-screen bg-base';
      
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

export const HighScore: Story = {
  args: {
    score: 12800,
    rank: 1,
    lyrics: sampleLyrics,
    leaderboard: [
      { rank: 1, username: 'CurrentUser', score: 12800, isCurrentUser: true },
      { rank: 2, username: 'KaraokeKing', score: 12500 },
      { rank: 3, username: 'SongBird92', score: 11200 },
      { rank: 4, username: 'MelodyMaster', score: 10800 },
      { rank: 5, username: 'VocalVirtuoso', score: 8200 },
    ],
    currentTime: 18,
    isPlaying: true,
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed: PlaybackSpeed) => console.log('Speed changed to:', speed),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'h-screen w-screen bg-base';
      
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