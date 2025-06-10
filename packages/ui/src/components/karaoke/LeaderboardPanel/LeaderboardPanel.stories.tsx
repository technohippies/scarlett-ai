import type { Meta, StoryObj } from '@storybook/html';
import { LeaderboardPanel, type LeaderboardPanelProps, type LeaderboardEntry } from './LeaderboardPanel';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<LeaderboardPanelProps> = {
  title: 'Karaoke/LeaderboardPanel',
  render: solidStory(LeaderboardPanel),
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<LeaderboardPanelProps>;

const sampleEntries: LeaderboardEntry[] = [
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
    entries: sampleEntries,
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base';
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

export const TopThree: Story = {
  args: {
    entries: sampleEntries.slice(0, 3),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base';
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

export const UserInTopThree: Story = {
  args: {
    entries: [
      { rank: 1, username: 'KaraokeKing', score: 12500 },
      { rank: 2, username: 'CurrentUser', score: 11200, isCurrentUser: true },
      { rank: 3, username: 'MelodyMaster', score: 10800 },
      { rank: 4, username: 'SongBird92', score: 9500 },
      { rank: 5, username: 'RhythmRider', score: 8400 },
    ],
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base';
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

export const Empty: Story = {
  args: {
    entries: [],
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base';
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