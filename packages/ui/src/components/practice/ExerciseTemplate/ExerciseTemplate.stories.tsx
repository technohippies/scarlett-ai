import type { Meta, StoryObj } from '@storybook/html';
import { render } from 'solid-js/web';
import { ExerciseTemplate } from './ExerciseTemplate';
import { MCQ } from '../MCQ';
import { ReadAloud } from '../ReadAloud';

const meta: Meta = {
  title: 'Practice/ExerciseTemplate',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

const sampleMCQOptions = [
  { id: 'a', text: 'Bonjour, comment allez-vous?' },
  { id: 'b', text: 'Hola, ¿cómo estás?' },
  { id: 'c', text: 'Hello, how are you?' },
  { id: 'd', text: 'Guten Tag, wie geht es Ihnen?' },
];

export const WithMCQ: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate instructionText="Choose the correct translation:">
        <MCQ
          question='How do you say "Hello, how are you?" in French?'
          options={sampleMCQOptions}
          correctOptionId="a"
          onComplete={(id, correct) => console.log('Selected:', id, 'Correct:', correct)}
        />
      </ExerciseTemplate>
    ), container);
    return container;
  },
};

export const WithReadAloud: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <ExerciseTemplate instructionText="Read aloud:">
        <ReadAloud
          prompt="The quick brown fox jumps over the lazy dog"
        />
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
          <p class="text-lg">This template has no instruction text.</p>
        </div>
      </ExerciseTemplate>
    ), container);
    return container;
  },
};