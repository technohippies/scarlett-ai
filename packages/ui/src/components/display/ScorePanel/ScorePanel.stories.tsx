import type { Meta, StoryObj } from '@storybook/html';
import { ScorePanel, type ScorePanelProps } from './ScorePanel';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<ScorePanelProps> = {
  title: 'Display/ScorePanel',
  render: solidStory(ScorePanel),
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