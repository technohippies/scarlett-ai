import type { Meta, StoryObj } from '@storybook/html';
import { HomePage, type HomePageProps } from './HomePage';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<HomePageProps> = {
  title: 'Pages/HomePage',
  render: withI18n(HomePage),
  parameters: {
    layout: 'fullscreen',
  }
};

export default meta;
type Story = StoryObj<HomePageProps>;

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
    onSongSelect: (song) => console.log('Selected:', song),
    showHero: true,
    onGetStarted: () => console.log('Get started clicked'),
    onSearch: (query) => console.log('Search:', query)
  },
};

export const NoHero: Story = {
  args: {
    songs: mockSongs,
    onSongSelect: (song) => console.log('Selected:', song),
    showHero: false,
    onSearch: (query) => console.log('Search:', query)
  },
};

export const WithSearch: Story = {
  args: {
    songs: mockSongs,
    onSongSelect: (song) => console.log('Selected:', song),
    showHero: true,
    onGetStarted: () => console.log('Get started clicked'),
    onSearch: (query) => console.log('Search:', query)
  },
  name: 'With Search Focused'
};