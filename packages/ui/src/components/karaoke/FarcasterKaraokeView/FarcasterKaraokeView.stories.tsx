import type { Meta, StoryObj } from 'storybook-solidjs';
import { FarcasterKaraokeView } from './FarcasterKaraokeView';
import type { LyricLine } from '../LyricsDisplay';
import type { LeaderboardEntry } from '../LeaderboardPanel';

const meta: Meta<typeof FarcasterKaraokeView> = {
  title: 'Karaoke/FarcasterKaraokeView',
  component: FarcasterKaraokeView,
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
type Story = StoryObj<typeof meta>;

const sampleLyrics: LyricLine[] = [
  { text: "Is this the real life?", startTime: 0, endTime: 3 },
  { text: "Is this just fantasy?", startTime: 3, endTime: 6 },
  { text: "Caught in a landslide", startTime: 6, endTime: 9 },
  { text: "No escape from reality", startTime: 9, endTime: 13 },
  { text: "Open your eyes", startTime: 13, endTime: 16 },
  { text: "Look up to the skies and see", startTime: 16, endTime: 21 },
  { text: "I'm just a poor boy", startTime: 21, endTime: 24 },
  { text: "I need no sympathy", startTime: 24, endTime: 27 },
];

const sampleLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: 'KaraokeKing', score: 12500 },
  { rank: 2, username: 'SongBird92', score: 11200 },
  { rank: 3, username: 'MelodyMaster', score: 10800 },
  { rank: 4, username: 'CurrentUser', score: 8750, isCurrentUser: true },
  { rank: 5, username: 'RhythmRider', score: 8400 },
  { rank: 6, username: 'BeatDropper', score: 7900 },
  { rank: 7, username: 'VocalVirtuoso', score: 7500 },
  { rank: 8, username: 'PitchPerfect', score: 7200 },
];

export const Default: Story = {
  args: {
    songTitle: 'Stronger',
    artist: 'Kanye West',
    score: 4735,
    rank: 7,
    lyrics: sampleLyrics,
    leaderboard: sampleLeaderboard,
    onStart: () => console.log('Starting karaoke'),
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full h-screen max-w-[424px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};

export const Playing: Story = {
  args: {
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    score: 4735,
    rank: 7,
    lyrics: sampleLyrics,
    leaderboard: sampleLeaderboard,
    currentTime: 10,
    isPlaying: true,
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full h-screen max-w-[424px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};

export const LowScore: Story = {
  args: {
    songTitle: 'Easy',
    artist: 'The Commodores',
    score: 1250,
    rank: 42,
    lyrics: sampleLyrics,
    leaderboard: sampleLeaderboard,
    onStart: () => console.log('Starting karaoke'),
    onBack: () => console.log('Going back'),
  },
  decorators: [
    (Story) => (
      <div class="w-full h-screen max-w-[424px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};