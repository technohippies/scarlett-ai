import type { Meta, StoryObj } from '@storybook/html';
import { SearchPage, type SearchPageProps } from './SearchPage';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<SearchPageProps> = {
  title: 'Pages/SearchPage',
  render: withI18n(SearchPage),
  parameters: {
    layout: 'fullscreen',
  }
};

export default meta;
type Story = StoryObj<SearchPageProps>;

const mockSongs = [
  { id: '1', trackId: 'track-001', title: 'Bohemian Rhapsody', artist: 'Queen', hasLyrics: true },
  { id: '2', trackId: 'track-002', title: 'Someone Like You', artist: 'Adele', hasLyrics: true },
  { id: '3', trackId: 'track-003', title: 'Shape of You', artist: 'Ed Sheeran', hasLyrics: false },
  { id: '4', trackId: 'track-004', title: 'Rolling in the Deep', artist: 'Adele', hasLyrics: true },
  { id: '5', trackId: 'track-005', title: 'Perfect', artist: 'Ed Sheeran', hasLyrics: true },
  { id: '6', trackId: 'track-006', title: 'Hotel California', artist: 'Eagles', hasLyrics: true },
  { id: '7', trackId: 'track-007', title: 'Stairway to Heaven', artist: 'Led Zeppelin', hasLyrics: false },
  { id: '8', trackId: 'track-008', title: 'Imagine', artist: 'John Lennon', hasLyrics: true },
  { id: '9', trackId: 'track-009', title: 'Wonderwall', artist: 'Oasis', hasLyrics: true },
  { id: '10', trackId: 'track-010', title: 'Hey Jude', artist: 'The Beatles', hasLyrics: true },
];

export const Default: Story = {
  args: {
    songs: mockSongs,
    onSongSelect: (song) => console.log('Selected:', song),
    onSearch: (query) => console.log('Search:', query),
  },
};

export const WithInitialQuery: Story = {
  args: {
    songs: mockSongs,
    searchQuery: 'Adele',
    onSongSelect: (song) => console.log('Selected:', song),
    onSearch: (query) => console.log('Search:', query),
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    onSearch: (query) => console.log('Search:', query),
  },
};

export const NoResults: Story = {
  args: {
    songs: [],
    searchQuery: 'asdfghjkl',
    onSongSelect: (song) => console.log('Selected:', song),
    onSearch: (query) => console.log('Search:', query),
  },
};

export const EmptySongs: Story = {
  args: {
    songs: [],
    onSongSelect: (song) => console.log('Selected:', song),
    onSearch: (query) => console.log('Search:', query),
  },
};