import type { Meta, StoryObj } from '@storybook/html';
import { PracticeHeader, type PracticeHeaderProps } from './PracticeHeader';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<PracticeHeaderProps> = {
  title: 'Practice/PracticeHeader',
  render: solidStory(PracticeHeader),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Optional title text',
    },
    onExit: {
      action: 'exit-clicked',
      description: 'Callback when exit button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<PracticeHeaderProps>;

export const Default: Story = {
  args: {
    onExit: () => console.log('Exit clicked'),
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Practice',
    onExit: () => console.log('Exit clicked'),
  },
};

export const InMobileLayout: Story = {
  args: {
    title: 'Say It Back',
    onExit: () => console.log('Exit clicked'),
  },
};