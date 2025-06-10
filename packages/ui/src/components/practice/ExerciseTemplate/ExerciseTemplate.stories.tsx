import type { Meta, StoryObj } from '@storybook/html';
import { render } from 'solid-js/web';
import { ExerciseTemplate } from './ExerciseTemplate';
import { Button } from '../../common/Button';

const meta: Meta = {
  title: 'Practice/ExerciseTemplate',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

// Helper function to create stories
const createStory = (instructionText: string | undefined, content: any) => ({
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate instructionText={instructionText}>
        {content}
      </ExerciseTemplate>
    ), container);
    return container;
  },
});

export const Default: Story = createStory(
  'Translate:',
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
);

export const ReadAloud: Story = createStory(
  'Read aloud:',
  <div class="space-y-4">
    <p class="text-xl md:text-2xl">
      The quick brown fox jumps over the lazy dog
    </p>
  </div>
);

export const NoInstruction: Story = createStory(
  undefined,
  <div class="space-y-4">
    <h2 class="text-2xl font-semibold">Exercise Content</h2>
    <p class="text-lg">This exercise has no instruction text.</p>
  </div>
);

export const ChooseCorrectAnswer: Story = createStory(
  'Choose the correct answer:',
  <div class="space-y-4">
    <p class="text-xl">What is 2 + 2?</p>
    <div class="space-y-3">
      <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">3</Button>
      <Button variant="secondary" fullWidth class="justify-start h-14 text-lg pl-4 border border-secondary">4</Button>
      <Button variant="outline" fullWidth class="justify-start h-14 text-lg pl-4">5</Button>
    </div>
  </div>
);