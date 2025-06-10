import { createSignal, onMount } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { CompletionView } from './CompletionView';

const meta: Meta<typeof CompletionView> = {
  title: 'Karaoke/CompletionView',
  component: CompletionView,
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
      description: 'LLM feedback text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const HighScore: Story = {
  args: {
    score: 8750,
    rank: 7,
    speed: '1x',
    feedbackText: 'Outstanding performance! Your rhythm was perfectly on point and your pitch accuracy was exceptional.',
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};

export const TopRank: Story = {
  args: {
    score: 12500,
    rank: 1,
    speed: '1x',
    feedbackText: 'Absolutely incredible! You just set a new record. Your vocal control and timing were flawless.',
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};

export const SlowSpeed: Story = {
  args: {
    score: 6200,
    rank: 23,
    speed: '0.5x',
    feedbackText: 'Great job practicing at a slower speed! Keep working on your timing and you\'ll be ready for full speed.',
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};

export const StreamingFeedback: Story = {
  render: () => {
    const [feedbackText, setFeedbackText] = createSignal('');
    
    onMount(() => {
      const fullText = 'Amazing work! Your vocal technique has really improved and your emotional delivery was spot on. Keep practicing and you\'ll be a karaoke superstar!';
      
      // Simulate streaming from LLM - text arrives in chunks
      const chunks = [
        'Amazing work!',
        'Amazing work! Your vocal technique has really improved',
        'Amazing work! Your vocal technique has really improved and your emotional delivery was spot on.',
        'Amazing work! Your vocal technique has really improved and your emotional delivery was spot on. Keep practicing and you\'ll be a karaoke superstar!',
      ];
      
      let index = 0;
      const interval = setInterval(() => {
        if (index < chunks.length) {
          setFeedbackText(chunks[index]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 1500);
    });
    
    return (
      <div class="w-full max-w-[420px] mx-auto">
        <CompletionView
          score={9250}
          rank={4}
          speed="0.75x"
          feedbackText={feedbackText()}
        />
      </div>
    );
  },
};

export const FarcasterView: Story = {
  args: {
    score: 7800,
    rank: 12,
    speed: '1x',
    feedbackText: 'Solid performance! Your consistency throughout the song was impressive. Try pushing your range a bit more next time.',
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[424px] mx-auto">
        {Story()}
      </div>
    ),
  ],
};