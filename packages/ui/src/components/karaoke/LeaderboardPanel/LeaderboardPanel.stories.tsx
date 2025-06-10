import type { Meta, StoryObj } from 'storybook-solidjs';
import { LeaderboardPanel } from './LeaderboardPanel';
import type { LeaderboardEntry } from './LeaderboardPanel';

const meta: Meta<typeof LeaderboardPanel> = {
  title: 'Karaoke/LeaderboardPanel',
  component: LeaderboardPanel,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

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
    (Story) => (
      <div class="w-full max-w-[420px] bg-base">
        {Story()}
      </div>
    ),
  ],
};

export const TopThree: Story = {
  args: {
    entries: sampleEntries.slice(0, 3),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] bg-base">
        {Story()}
      </div>
    ),
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
    (Story) => (
      <div class="w-full max-w-[420px] bg-base">
        {Story()}
      </div>
    ),
  ],
};

export const Empty: Story = {
  args: {
    entries: [],
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] bg-base">
        {Story()}
      </div>
    ),
  ],
};