import type { Meta, StoryObj } from '@storybook/html';
import { SayItBack } from './SayItBack';
import { solidStory } from '../../../utils/storybook';

const meta: Meta = {
  title: 'Practice/SayItBack',
  render: solidStory(SayItBack),
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    prompt: {
      control: 'text',
      description: 'The phrase to repeat',
    },
    audioUrl: {
      control: 'text',
      description: 'URL of the audio file',
    },
    isPlaying: {
      control: 'boolean',
      description: 'Whether audio is currently playing',
    },
    userTranscript: {
      control: 'text',
      description: 'User\'s transcribed response',
    },
    isCorrect: {
      control: 'boolean',
      description: 'Whether the response is correct',
    },
    onPlayAudio: {
      action: 'play-audio',
      description: 'Callback when play button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    onPlayAudio: () => console.log('Play audio'),
  },
};

export const Playing: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    isPlaying: true,
    onPlayAudio: () => console.log('Play audio'),
  },
};

export const WithUserResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you today?',
    onPlayAudio: () => console.log('Play audio'),
  },
};

export const CorrectResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you today?',
    isCorrect: true,
    onPlayAudio: () => console.log('Play audio'),
  },
};

export const IncorrectResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you?',
    isCorrect: false,
    onPlayAudio: () => console.log('Play audio'),
  },
};

export const LongPhrase: Story = {
  args: {
    prompt: 'The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.',
    userTranscript: 'The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.',
    isCorrect: true,
    onPlayAudio: () => console.log('Play audio'),
  },
};