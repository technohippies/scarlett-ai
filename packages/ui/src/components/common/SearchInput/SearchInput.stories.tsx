import type { Meta, StoryObj } from '@storybook/html';
import { SearchInput, type SearchInputProps } from './SearchInput';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<SearchInputProps> = {
  title: 'Common/SearchInput',
  render: solidStory(SearchInput),
  argTypes: {
    placeholder: {
      control: 'text',
    },
    value: {
      control: 'text',
    },
    loading: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<SearchInputProps>;

export const Default: Story = {
  args: {
    placeholder: 'Search songs...',
  },
};

export const WithValue: Story = {
  args: {
    placeholder: 'Search songs...',
    value: 'Taylor Swift',
    onClear: () => console.log('Clear clicked'),
  },
};

export const ChinesePlaceholder: Story = {
  args: {
    placeholder: '搜索歌曲、艺术家...',
  },
};

export const Loading: Story = {
  args: {
    placeholder: 'Search songs...',
    value: 'Searching...',
    loading: true,
  },
};