import type { Meta, StoryObj } from '@storybook/html';
import { OnboardingFlow, type OnboardingFlowProps } from './OnboardingFlow';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<OnboardingFlowProps> = {
  title: 'Onboarding/OnboardingFlow',
  render: solidStory(OnboardingFlow),
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  argTypes: {
    step: {
      control: 'select',
      options: ['connect-wallet', 'generating-token', 'complete'],
      description: 'Current step in the onboarding flow',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    walletAddress: {
      control: 'text',
      description: 'Connected wallet address',
    },
    token: {
      control: 'text',
      description: 'Generated JWT token',
    },
    isConnecting: {
      control: 'boolean',
      description: 'Whether wallet is currently connecting',
    },
    isGenerating: {
      control: 'boolean',
      description: 'Whether token is being generated',
    },
  },
};

export default meta;
type Story = StoryObj<OnboardingFlowProps>;

export const ConnectWallet: Story = {
  args: {
    step: 'connect-wallet',
    onConnectWallet: () => console.log('Connect wallet clicked'),
    onUseTestMode: () => console.log('Use test mode clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const ConnectingWallet: Story = {
  args: {
    step: 'connect-wallet',
    isConnecting: true,
    onConnectWallet: () => console.log('Connect wallet clicked'),
    onUseTestMode: () => console.log('Use test mode clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const WalletError: Story = {
  args: {
    step: 'connect-wallet',
    error: 'MetaMask is not installed. Please install MetaMask to continue.',
    onConnectWallet: () => console.log('Connect wallet clicked'),
    onUseTestMode: () => console.log('Use test mode clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const GeneratingToken: Story = {
  args: {
    step: 'generating-token',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f89590',
    isGenerating: true,
    onConnectWallet: () => console.log('Connect wallet clicked'),
    onUseTestMode: () => console.log('Use test mode clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

export const Complete: Story = {
  args: {
    step: 'complete',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f89590',
    token: 'scarlett_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    onConnectWallet: () => console.log('Connect wallet clicked'),
    onUseTestMode: () => console.log('Use test mode clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
};

// Interactive flow with wallet connection simulation
export const InteractiveFlow: Story = {
  render: (args) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'h-screen bg-base';
    
    let currentStep: OnboardingFlowProps['step'] = 'connect-wallet';
    let error: string | null = null;
    let walletAddress: string | null = null;
    let token: string | null = null;
    let isConnecting = false;
    let isGenerating = false;
    
    const render = () => {
      wrapper.innerHTML = '';
      const element = solidStory(OnboardingFlow)({
        ...args,
        step: currentStep,
        error,
        walletAddress,
        token,
        isConnecting,
        isGenerating,
        onConnectWallet: async () => {
          console.log('Connect wallet clicked');
          error = null;
          isConnecting = true;
          render();
          
          // Simulate wallet connection
          setTimeout(() => {
            isConnecting = false;
            walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89590';
            currentStep = 'generating-token';
            isGenerating = true;
            render();
            
            // Simulate token generation
            setTimeout(() => {
              isGenerating = false;
              token = 'scarlett_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
              currentStep = 'complete';
              render();
            }, 2000);
          }, 1500);
        },
        onUseTestMode: () => {
          console.log('Use test mode clicked');
          error = null;
          walletAddress = 'demo-user';
          currentStep = 'generating-token';
          isGenerating = true;
          render();
          
          // Simulate token generation for test mode
          setTimeout(() => {
            isGenerating = false;
            token = 'scarlett_test_demo_user_12345';
            currentStep = 'complete';
            render();
          }, 1000);
        },
        onComplete: () => {
          console.log('Complete clicked - would close window');
          // Reset for demo
          currentStep = 'connect-wallet';
          error = null;
          walletAddress = null;
          token = null;
          render();
        },
      });
      
      if (typeof element === 'string') {
        wrapper.innerHTML = element;
      } else {
        wrapper.appendChild(element);
      }
    };
    
    render();
    
    return wrapper;
  },
};