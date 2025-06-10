import type { Meta, StoryObj } from '@storybook/html';
import { MCQ, type MCQProps } from './MCQ';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<MCQProps> = {
  title: 'Practice/MCQ',
  render: solidStory(MCQ),
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    question: {
      control: 'text',
      description: 'The question to ask',
    },
    correctOptionId: {
      control: 'text',
      description: 'ID of the correct answer',
    },
    onComplete: {
      action: 'completed',
      description: 'Callback when option is selected',
    },
  },
};

export default meta;
type Story = StoryObj<MCQProps>;

const sampleOptions = [
  { id: 'a', text: 'Bonjour, comment allez-vous?' },
  { id: 'b', text: 'Hola, ¿cómo estás?' },
  { id: 'c', text: 'Hello, how are you?' },
  { id: 'd', text: 'Guten Tag, wie geht es Ihnen?' },
];

export const Default: Story = {
  args: {
    question: 'How do you say "Hello, how are you?" in French?',
    options: sampleOptions,
    correctOptionId: 'a',
    onComplete: (id: string | number, correct: boolean) => console.log('Selected:', id, 'Correct:', correct),
  },
};

export const LongQuestion: Story = {
  args: {
    question: 'Which of the following phrases would you use to politely greet someone you don\'t know very well in a formal business setting?',
    options: sampleOptions,
    correctOptionId: 'a',
    onComplete: (id: string | number, correct: boolean) => console.log('Selected:', id, 'Correct:', correct),
  },
};

export const ManyOptions: Story = {
  args: {
    question: 'Which language is this: "Guten Tag"?',
    options: [
      { id: '1', text: 'French' },
      { id: '2', text: 'Spanish' },
      { id: '3', text: 'German' },
      { id: '4', text: 'Italian' },
      { id: '5', text: 'Portuguese' },
      { id: '6', text: 'Dutch' },
    ],
    correctOptionId: '3',
    onComplete: (id: string | number, correct: boolean) => console.log('Selected:', id, 'Correct:', correct),
  },
};

export const ShortOptions: Story = {
  args: {
    question: 'What is 2 + 2?',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
      { id: 'c', text: '5' },
    ],
    correctOptionId: 'b',
    onComplete: (id: string | number, correct: boolean) => console.log('Selected:', id, 'Correct:', correct),
  },
};