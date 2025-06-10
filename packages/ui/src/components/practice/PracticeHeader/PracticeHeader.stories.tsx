import type { Meta, StoryObj } from 'storybook-solidjs';
import { PracticeHeader } from './PracticeHeader';

const meta: Meta<typeof PracticeHeader> = {
  title: 'Practice/PracticeHeader',
  component: PracticeHeader,
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
type Story = StoryObj<typeof meta>;

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
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto bg-base min-h-screen">
        {Story()}
        <div class="p-4">
          <p class="text-center">Content below header</p>
        </div>
      </div>
    ),
  ],
};