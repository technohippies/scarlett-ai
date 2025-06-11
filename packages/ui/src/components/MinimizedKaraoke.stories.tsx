import type { Meta, StoryObj } from '@storybook/html';
import { MinimizedKaraoke, type MinimizedKaraokeProps } from './MinimizedKaraoke';
import { solidStory } from '../utils/storybook';

const meta: Meta<MinimizedKaraokeProps> = {
  title: 'Components/MinimizedKaraoke',
  render: solidStory(MinimizedKaraoke),
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<MinimizedKaraokeProps>;

export const Default: Story = {
  args: {
    onClick: () => console.log('Minimized karaoke clicked'),
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.cssText = 'height: 100vh; position: relative; background: #f0f0f0;';
    container.appendChild(solidStory(MinimizedKaraoke)(args));
    return container;
  },
};

export const WithHoverEffect: Story = {
  args: {
    onClick: () => console.log('Minimized karaoke clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover over the circle to see the scale effect',
      },
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.cssText = 'height: 100vh; position: relative; background: #f0f0f0;';
    container.appendChild(solidStory(MinimizedKaraoke)(args));
    return container;
  },
};