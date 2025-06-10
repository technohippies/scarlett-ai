import type { Meta, StoryObj } from '@storybook/html';
import { PracticeExercise } from './PracticeExercise';
import { solidStory } from '../../../utils/storybook';

const meta: Meta = {
  title: 'Practice/PracticeExercise',
  render: solidStory(PracticeExercise),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentIndex: {
      control: { type: 'range', min: 0, max: 4, step: 1 },
      description: 'Current exercise index',
    },
    onExit: {
      action: 'exit',
      description: 'Called when user exits practice',
    },
    onComplete: {
      action: 'complete',
      description: 'Called when practice is completed',
    },
    onPlayAudio: {
      action: 'play-audio',
      description: 'Called to play audio',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleExercises = [
  {
    id: '1',
    type: 'say-it-back' as const,
    prompt: 'Hello, how are you today?',
    audioUrl: '/audio/hello.mp3',
  },
  {
    id: '2',
    type: 'say-it-back' as const,
    prompt: 'The weather is nice today.',
    audioUrl: '/audio/weather.mp3',
  },
  {
    id: '3',
    type: 'say-it-back' as const,
    prompt: 'I would like a cup of coffee.',
    audioUrl: '/audio/coffee.mp3',
  },
  {
    id: '4',
    type: 'say-it-back' as const,
    prompt: 'Thank you very much.',
    audioUrl: '/audio/thanks.mp3',
  },
  {
    id: '5',
    type: 'say-it-back' as const,
    prompt: 'See you tomorrow!',
    audioUrl: '/audio/tomorrow.mp3',
  },
];

export const Default: Story = {
  args: {
    exercises: sampleExercises,
    currentIndex: 0,
    onExit: () => console.log('Exit practice'),
    onComplete: (results) => console.log('Complete:', results),
  },
};

export const MidProgress: Story = {
  args: {
    exercises: sampleExercises,
    currentIndex: 2,
    onExit: () => console.log('Exit practice'),
    onComplete: (results) => console.log('Complete:', results),
  },
};

export const LastExercise: Story = {
  args: {
    exercises: sampleExercises,
    currentIndex: 4,
    onExit: () => console.log('Exit practice'),
    onComplete: (results) => console.log('Complete:', results),
  },
};

export const SingleExercise: Story = {
  args: {
    exercises: [sampleExercises[0]],
    currentIndex: 0,
    onExit: () => console.log('Exit practice'),
    onComplete: (results) => console.log('Complete:', results),
  },
};

export const MobileLayout: Story = {
  args: {
    exercises: sampleExercises,
    currentIndex: 1,
    onExit: () => console.log('Exit practice'),
    onComplete: (results) => console.log('Complete:', results),
  },
};