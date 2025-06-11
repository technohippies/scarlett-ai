import type { Meta, StoryObj } from 'storybook-solidjs';
import { HomePage } from './HomePage';

const meta = {
  title: 'Pages/HomePage',
  component: HomePage,
  parameters: {
    layout: 'fullscreen',
  }
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockSongs = [
  { id: '1', trackId: 'track-001', title: 'Bohemian Rhapsody', artist: 'Queen' },
  { id: '2', trackId: 'track-002', title: 'Someone Like You', artist: 'Adele' },
  { id: '3', trackId: 'track-003', title: 'Shape of You', artist: 'Ed Sheeran' },
  { id: '4', trackId: 'track-004', title: 'Rolling in the Deep', artist: 'Adele' },
  { id: '5', trackId: 'track-005', title: 'Perfect', artist: 'Ed Sheeran' }
];

export const Default: Story = {
  args: {
    songs: mockSongs,
    onSongSelect: (song) => console.log('Selected:', song)
  },
};