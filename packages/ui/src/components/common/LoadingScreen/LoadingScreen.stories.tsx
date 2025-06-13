import type { Meta, StoryObj } from '@storybook/html';
import type { LoadingScreenProps } from './LoadingScreen';
import { LoadingScreen } from './LoadingScreen';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<LoadingScreenProps> = {
  title: 'Common/LoadingScreen',
  argTypes: {
    message: { control: 'text' },
    variant: {
      control: 'select',
      options: ['fullscreen', 'inline', 'overlay'],
    },
  },
};

export default meta;
type Story = StoryObj<LoadingScreenProps>;

export const Fullscreen: Story = solidStory({
  args: {
    variant: 'fullscreen',
    message: 'Loading your experience...',
  },
  render: LoadingScreen,
});

export const Inline: Story = solidStory({
  args: {
    variant: 'inline',
    message: 'Loading songs...',
  },
  render: (props) => (
    <div class="w-96 h-64 bg-surface rounded-lg border border-subtle">
      <LoadingScreen {...props} />
    </div>
  ),
});

export const Overlay: Story = solidStory({
  args: {
    variant: 'overlay',
    message: 'Processing...',
  },
  render: (props) => (
    <div class="relative w-96 h-64 bg-surface rounded-lg border border-subtle p-6">
      <h3 class="text-lg font-semibold mb-4">Content underneath</h3>
      <p class="text-secondary">This content is behind the loading overlay.</p>
      <LoadingScreen {...props} />
    </div>
  ),
});

export const NoMessage: Story = solidStory({
  args: {
    variant: 'fullscreen',
  },
  render: LoadingScreen,
});

export const CustomClass: Story = solidStory({
  args: {
    variant: 'inline',
    message: 'Custom styled loading...',
    class: 'bg-accent-primary/10 rounded-lg',
  },
  render: (props) => (
    <div class="w-96 h-64 bg-surface rounded-lg border border-subtle p-4">
      <LoadingScreen {...props} />
    </div>
  ),
});