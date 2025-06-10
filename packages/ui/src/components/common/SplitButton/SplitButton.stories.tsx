import type { Meta, StoryObj } from 'storybook-solidjs';
import { SplitButton } from './SplitButton';

const meta: Meta<typeof SplitButton> = {
  title: 'Common/SplitButton',
  component: SplitButton,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed) => console.log('Speed changed to:', speed),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed) => console.log('Speed changed to:', speed),
  },
};

export const InContext: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed) => console.log('Speed changed to:', speed),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] bg-base p-4">
        <div class="bg-surface border-t border-subtle p-4">
          {Story()}
        </div>
      </div>
    ),
  ],
};

export const FullWidth: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
    onSpeedChange: (speed) => console.log('Speed changed to:', speed),
    class: 'w-full',
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] bg-base p-4">
        {Story()}
      </div>
    ),
  ],
};