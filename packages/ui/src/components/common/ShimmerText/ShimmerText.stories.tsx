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
    speed: {
      control: { type: 'range', min: 20, max: 100, step: 10 },
      description: 'Milliseconds per character',
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

export const Faster: Story = {
  args: {
    text: 'This text streams a bit faster for quick feedback.',
    speed: 30,
    class: 'text-lg',
  },
};

export const Slower: Story = {
  args: {
    text: 'This text streams more slowly for dramatic effect.',
    speed: 120,
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
    let index = 0;
    
    // Simulate streaming text
    const interval = setInterval(() => {
      if (index < messages.length) {
        setText(messages[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
    
    return (
      <ShimmerText text={text()} class="text-lg" />
    );
  },
};