import type { Meta, StoryObj } from '@storybook/html';
import { ProgressBar, type ProgressBarProps } from './ProgressBar';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<ProgressBarProps> = {
  title: 'Common/ProgressBar',
  render: solidStory(ProgressBar),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    current: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Current progress value',
    },
    total: {
      control: { type: 'range', min: 1, max: 10, step: 1 },
      description: 'Total value',
    },
  },
};

export default meta;
type Story = StoryObj<ProgressBarProps>;

export const Default: Story = {
  args: {
    current: 3,
    total: 10,
  },
};

export const Empty: Story = {
  args: {
    current: 0,
    total: 10,
  },
};

export const Half: Story = {
  args: {
    current: 5,
    total: 10,
  },
};

export const Complete: Story = {
  args: {
    current: 10,
    total: 10,
  },
};

export const InMobileLayout: Story = {
  args: {
    current: 7,
    total: 15,
  },
};