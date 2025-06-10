import type { Meta, StoryObj } from 'storybook-solidjs';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Common/ProgressBar',
  component: ProgressBar,
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
type Story = StoryObj<typeof meta>;

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
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto">
        {Story()}
        <div class="p-4">
          <p class="text-center text-lg">Content below progress bar</p>
        </div>
      </div>
    ),
  ],
};