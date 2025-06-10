import type { Meta, StoryObj } from 'storybook-solidjs';
import { TextEffect } from './TextEffect';
import { SimpleTest } from './SimpleTest';

const meta: Meta<typeof TextEffect> = {
  title: 'Common/TextEffect',
  component: TextEffect,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'Text content to animate',
    },
    per: {
      control: 'select',
      options: ['char', 'word'],
      description: 'Animation unit',
    },
    preset: {
      control: 'select',
      options: ['fade', 'slide', 'blur', 'scale'],
      description: 'Animation preset',
    },
    delay: {
      control: { type: 'range', min: 0, max: 3, step: 0.1 },
      description: 'Delay before animation starts (seconds)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PerCharacter: Story = {
  args: {
    children: 'Animate your ideas with motion-primitives',
    per: 'char',
    preset: 'fade',
    className: 'text-lg',
  },
};

export const PerWord: Story = {
  args: {
    children: 'Animate your ideas with motion-primitives',
    per: 'word',
    preset: 'slide',
    className: 'text-lg font-semibold',
  },
};

export const BlurEffect: Story = {
  args: {
    children: 'Beautiful blur transition effect',
    per: 'char',
    preset: 'blur',
    className: 'text-xl',
  },
};

export const ScaleEffect: Story = {
  args: {
    children: 'Smooth scaling animation',
    per: 'word',
    preset: 'scale',
    className: 'text-lg',
  },
};

export const WithDelay: Story = {
  args: {
    children: 'This appears after a delay',
    per: 'char',
    preset: 'fade',
    delay: 1,
    className: 'text-lg',
  },
};

export const SimpleAnimationTest = () => {
  return <SimpleTest />;
};

export const DebugTextEffect = () => {
  return (
    <div>
      <h3>Debug: Text should fade in</h3>
      <TextEffect per="char" preset="fade" className="text-lg">
        Hello, this text should animate!
      </TextEffect>
    </div>
  );
};