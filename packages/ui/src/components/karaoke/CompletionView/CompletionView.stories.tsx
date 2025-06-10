import type { Meta, StoryObj } from '@storybook/html';
import { CompletionView, type CompletionViewProps } from './CompletionView';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<CompletionViewProps> = {
  title: 'Karaoke/CompletionView',
  render: withI18n(CompletionView),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    score: {
      control: 'number',
      description: 'Final score',
    },
    rank: {
      control: 'number',
      description: 'Global rank',
    },
    speed: {
      control: 'select',
      options: ['1x', '0.75x', '0.5x'],
      description: 'Playback speed used',
    },
    feedbackText: {
      control: 'text',
      description: 'Custom feedback text (optional)',
    },
    onPractice: {
      action: 'practice-clicked',
      description: 'Callback when practice button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<CompletionViewProps>;

export const Default: Story = {
  args: {
    score: 87,
    rank: 7,
    speed: '1x',
    onPractice: () => console.log('Practice clicked!'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] mx-auto';
      const storyElement = Story();
      if (storyElement instanceof Node) {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const TopRank: Story = {
  args: {
    score: 98,
    rank: 1,
    speed: '1x',
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] mx-auto';
      const storyElement = Story();
      if (storyElement instanceof Node) {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const WithCustomFeedback: Story = {
  args: {
    score: 75,
    rank: 15,
    speed: '0.75x',
    feedbackText: 'Great job! Your rhythm was on point and you hit those high notes perfectly.',
    onPractice: () => console.log('Practice clicked!'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] mx-auto';
      const storyElement = Story();
      if (storyElement instanceof Node) {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const WithoutPracticeButton: Story = {
  args: {
    score: 50,
    rank: 42,
    speed: '0.5x',
    // No onPractice prop - button won't show
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] mx-auto';
      const storyElement = Story();
      if (storyElement instanceof Node) {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};