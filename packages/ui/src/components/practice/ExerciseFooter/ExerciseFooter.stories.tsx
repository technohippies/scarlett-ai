import type { Meta, StoryObj } from '@storybook/html';
import { ExerciseFooter } from './ExerciseFooter';
import { solidStory } from '../../../utils/storybook';

const meta: Meta = {
  title: 'Practice/ExerciseFooter',
  render: solidStory(ExerciseFooter),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isRecording: {
      control: 'boolean',
      description: 'Whether currently recording',
    },
    isProcessing: {
      control: 'boolean',
      description: 'Whether processing the recording',
    },
    canSubmit: {
      control: 'boolean',
      description: 'Whether the user can submit',
    },
    onRecord: {
      action: 'record-clicked',
      description: 'Callback when record button is clicked',
    },
    onStop: {
      action: 'stop-clicked',
      description: 'Callback when stop button is clicked',
    },
    onSubmit: {
      action: 'submit-clicked',
      description: 'Callback when submit button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onSubmit: () => console.log('Submit clicked'),
  },
};

export const Recording: Story = {
  args: {
    isRecording: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onSubmit: () => console.log('Submit clicked'),
  },
};

export const CanSubmit: Story = {
  args: {
    canSubmit: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onSubmit: () => console.log('Submit clicked'),
  },
};

export const Processing: Story = {
  args: {
    canSubmit: true,
    isProcessing: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onSubmit: () => console.log('Submit clicked'),
  },
};

export const InMobileLayout: Story = {
  args: {
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onSubmit: () => console.log('Submit clicked'),
  },
  decorators: [
    (Story) => (
      <div class="w-full max-w-[420px] mx-auto bg-base min-h-screen relative">
        <div class="p-4 pb-24">
          <h2 class="text-xl font-semibold mb-4">Say It Back</h2>
          <p class="text-lg">Listen to the phrase and repeat it back.</p>
        </div>
        {Story()}
      </div>
    ),
  ],
};