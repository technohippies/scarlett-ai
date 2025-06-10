import type { Meta, StoryObj } from '@storybook/html';
import { ExerciseTemplate } from './ExerciseTemplate';
import { Button } from '../../common/Button';
import { solidStory } from '../../../utils/storybook';
import { render } from 'solid-js/web';

const meta: Meta = {
  title: 'Practice/ExerciseTemplate',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    instructionText: {
      control: 'text',
      description: 'Instruction text shown above the exercise content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    instructionText: 'Translate:',
  },
  render: (args) => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate {...args}>
        <div class="space-y-4">
          <p class="text-xl md:text-2xl">Hello, how are you today?</p>
          <div class="space-y-3">
            <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">
              Bonjour, comment allez-vous aujourd'hui?
            </Button>
            <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">
              Hola, ¿cómo estás hoy?
            </Button>
            <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">
              Hallo, wie geht es dir heute?
            </Button>
          </div>
        </div>
      </ExerciseTemplate>
    ), container);
    return container;
  },
};

export const WithLongContent: Story = {
  args: {
    instructionText: 'Listen and repeat:',
  },
  render: (args) => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate {...args}>
        <div class="space-y-4">
          <p class="text-xl md:text-2xl">
            The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.
          </p>
          <Button variant="primary" size="lg">
            Play Audio
          </Button>
        </div>
      </ExerciseTemplate>
    ), container);
    return container;
  },
};

export const NoInstruction: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate>
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold">Exercise Content</h2>
          <p class="text-lg">This exercise has no instruction text.</p>
        </div>
      </ExerciseTemplate>
    ), container);
    return container;
  },
};

export const InMobileLayout: Story = {
  args: {
    instructionText: 'Choose the correct answer:',
  },
  render: (args) => {
    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-[420px] mx-auto bg-base min-h-screen';
    
    render(() => (
      <ExerciseTemplate {...args}>
        <div class="space-y-4">
          <p class="text-xl">What is 2 + 2?</p>
          <div class="space-y-3">
            <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">3</Button>
            <Button variant="secondary" fullWidth class="justify-start h-14 text-lg pl-4 border border-secondary">4</Button>
            <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">5</Button>
          </div>
        </div>
      </ExerciseTemplate>
    ), container);
    
    wrapper.appendChild(container);
    return wrapper;
  },
};