import type { Meta, StoryObj } from '@storybook/html';
import { OnboardingFlow, type OnboardingFlowProps } from './OnboardingFlow';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<OnboardingFlowProps> = {
  title: 'Onboarding/OnboardingFlow',
  render: solidStory(OnboardingFlow),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    step: {
      control: 'select',
      options: ['token-input', 'welcome', 'complete'],
      description: 'Current step in the onboarding flow',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    tokenVerified: {
      control: 'boolean',
      description: 'Whether the token has been verified',
    },
    defaultToken: {
      control: 'text',
      description: 'Default token value to prefill',
    },
    tokenPlaceholder: {
      control: 'text',
      description: 'Placeholder text for token input',
    },
    getTokenUrl: {
      control: 'text',
      description: 'URL for getting a token',
    },
  },
};

export default meta;
type Story = StoryObj<OnboardingFlowProps>;

export const TokenInput: Story = {
  args: {
    step: 'token-input',
    defaultToken: 'scarlett_test_demo_user_12345',
    tokenPlaceholder: 'scarlett_...',
    getTokenUrl: 'https://scarlettx.xyz',
    onTokenSubmit: (token: string) => console.log('Token submitted:', token),
    onGetStarted: () => console.log('Get started clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const TokenInputWithError: Story = {
  args: {
    step: 'token-input',
    error: 'Invalid token format. Token must start with "scarlett_"',
    defaultToken: '',
    tokenPlaceholder: 'scarlett_...',
    getTokenUrl: 'https://scarlettx.xyz',
    onTokenSubmit: (token: string) => console.log('Token submitted:', token),
    onGetStarted: () => console.log('Get started clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const Welcome: Story = {
  args: {
    step: 'welcome',
    tokenVerified: true,
    onTokenSubmit: (token: string) => console.log('Token submitted:', token),
    onGetStarted: () => console.log('Get started clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const Complete: Story = {
  args: {
    step: 'complete',
    tokenVerified: true,
    onTokenSubmit: (token: string) => console.log('Token submitted:', token),
    onGetStarted: () => console.log('Get started clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

// Interactive flow example
export const InteractiveFlow: Story = {
  render: (args) => {
    // Create a wrapper div to hold our interactive component
    const wrapper = document.createElement('div');
    wrapper.className = 'h-screen';
    
    // Track state
    let currentStep: OnboardingFlowProps['step'] = 'token-input';
    let error: string | null = null;
    let tokenVerified = false;
    
    // Helper to re-render
    const render = () => {
      wrapper.innerHTML = '';
      const element = solidStory(OnboardingFlow)({
        ...args,
        step: currentStep,
        error,
        tokenVerified,
        onTokenSubmit: (token: string) => {
          console.log('Token submitted:', token);
          if (token.startsWith('scarlett_')) {
            error = null;
            tokenVerified = true;
            currentStep = 'welcome';
            render();
          } else {
            error = 'Invalid token format. Token must start with "scarlett_"';
            render();
          }
        },
        onGetStarted: () => {
          console.log('Get started clicked');
          currentStep = 'complete';
          render();
        },
        onComplete: () => {
          console.log('Complete clicked - would close window');
          // Reset for demo
          currentStep = 'token-input';
          error = null;
          tokenVerified = false;
          render();
        },
      });
      
      if (typeof element === 'string') {
        wrapper.innerHTML = element;
      } else {
        wrapper.appendChild(element);
      }
    };
    
    // Initial render
    render();
    
    return wrapper;
  },
  args: {
    defaultToken: 'scarlett_test_demo_user_12345',
    tokenPlaceholder: 'scarlett_...',
    getTokenUrl: 'https://scarlettx.xyz',
  },
};