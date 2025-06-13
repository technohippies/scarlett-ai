import type { Meta, StoryObj } from '@storybook/html';
import { SplitButton, type SplitButtonProps } from './SplitButton';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<SplitButtonProps> = {
  title: 'Common/SplitButton',
  render: (args, context) => withI18n(SplitButton)(args, context),
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
  },
};

export default meta;
type Story = StoryObj<SplitButtonProps>;

export const Default: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onStart: () => console.log('Start karaoke!'),
  },
};

export const InContext: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base p-4';
      
      const inner = document.createElement('div');
      inner.className = 'bg-surface border-t border-subtle p-4';
      
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        inner.innerHTML = storyElement;
      } else {
        inner.appendChild(storyElement);
      }
      
      container.appendChild(inner);
      return container;
    },
  ],
};

export const FullWidth: Story = {
  args: {
    onStart: () => console.log('Start karaoke!'),
    class: 'w-full',
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-[420px] bg-base p-4';
      
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      
      return container;
    },
  ],
};