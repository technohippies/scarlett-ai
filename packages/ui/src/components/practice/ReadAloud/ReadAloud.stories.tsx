import type { Meta, StoryObj } from '@storybook/html';
import { ReadAloud } from './ReadAloud';
import { solidStory } from '../../../utils/storybook';

const meta: Meta = {
  title: 'Practice/ReadAloud',
  render: solidStory(ReadAloud),
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    prompt: {
      control: 'text',
      description: 'The text to read aloud',
    },
    userTranscript: {
      control: 'text',
      description: 'User\'s transcribed response',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    prompt: 'Hello, how are you today?',
  },
};

export const WithUserResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you today?',
  },
};

export const MatchingResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you today?',
  },
};

export const DifferentResponse: Story = {
  args: {
    prompt: 'Hello, how are you today?',
    userTranscript: 'Hello, how are you?',
  },
};

export const LongPhrase: Story = {
  args: {
    prompt: 'The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.',
    userTranscript: 'The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.',
  },
};