import { createSignal } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { ShimmerText } from './ShimmerText';

const meta: Meta<typeof ShimmerText> = {
  title: 'Common/ShimmerText',
  component: ShimmerText,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    text: {
      control: 'text',
      description: 'Text to display with shimmer effect',
    },
    shimmer: {
      control: 'boolean',
      description: 'Enable shimmer effect',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: 'Your performance was absolutely stellar! Keep up the amazing work.',
    class: 'text-lg',
  },
};

export const NoShimmer: Story = {
  args: {
    text: 'This text appears without the shimmer effect.',
    shimmer: false,
    class: 'text-lg',
  },
};

export const StreamingSimulation: Story = {
  render: () => {
    const messages = [
      'Incredible job!',
      'Incredible job! Your rhythm was perfect.',
      'Incredible job! Your rhythm was perfect. You nailed every beat!',
    ];
    
    const [text, setText] = createSignal('');
    const [index, setIndex] = createSignal(0);
    
    // Simulate streaming text
    setTimeout(() => {
      const interval = setInterval(() => {
        const currentIndex = index();
        if (currentIndex < messages.length) {
          setText(messages[currentIndex]);
          setIndex(currentIndex + 1);
        } else {
          clearInterval(interval);
        }
      }, 3000);
    }, 500);
    
    return () => (
      <ShimmerText text={text()} class="text-lg" />
    );
  },
};