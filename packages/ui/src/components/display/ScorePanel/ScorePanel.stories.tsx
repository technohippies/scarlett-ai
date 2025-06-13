import type { Meta, StoryObj } from '@storybook/html';
import { ScorePanel, type ScorePanelProps } from './ScorePanel';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<ScorePanelProps> = {
  title: 'Display/ScorePanel',
  render: (args, context) => withI18n(ScorePanel)(args, context),
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
    backgroundImage: {
      control: 'text',
      description: 'URL for background image',
    },
  },
};

export default meta;
type Story = StoryObj<ScorePanelProps>;

export const Default: Story = {
  args: {
    score: 4735,
    rank: 7,
  },
};

export const HighScore: Story = {
  args: {
    score: 12500,
    rank: 1,
  },
};

export const LowScore: Story = {
  args: {
    score: 250,
    rank: 127,
  },
};

export const ExtremeValues: Story = {
  args: {
    score: 9999999,
    rank: 1,
  },
};

export const MinimalValues: Story = {
  args: {
    score: 0,
    rank: 1,
  },
};

export const WithBackgroundImage: Story = {
  args: {
    score: 8765,
    rank: 3,
    backgroundImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
  },
};

export const NoScores: Story = {
  args: {
    score: null,
    rank: null,
  },
};

export const OnlyScore: Story = {
  args: {
    score: 5000,
    rank: null,
  },
};

export const WithAlbumArt: Story = {
  args: {
    score: 9250,
    rank: 2,
    backgroundImage: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=800',
  },
};

export const DarkBackground: Story = {
  args: {
    score: 7500,
    rank: 5,
    backgroundImage: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=800',
  },
};