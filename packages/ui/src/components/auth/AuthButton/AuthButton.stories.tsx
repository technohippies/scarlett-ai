import type { Meta, StoryObj } from '@storybook/html';
import { AuthButton, type AuthButtonProps } from './AuthButton';
import { solidStory } from '../../../utils/storybook';
import { createSignal } from 'solid-js';
import { AuthContext } from '@scarlett/auth';

const meta: Meta<AuthButtonProps> = {
  title: 'Auth/AuthButton',
  render: (args) => {
    const container = document.createElement('div');
    container.className = 'p-8 bg-background min-h-[200px] flex justify-end';
    
    // Create a mock auth button without auth context for display
    const MockAuthButton = (props: AuthButtonProps) => {
      // Mock user state
      const mockUser = args.mockUser || null;
      const [showDropdown, setShowDropdown] = createSignal(false);
      
      return (
        <AuthContext.Provider value={{
          user: () => mockUser,
          isLoading: () => args.mockLoading || false,
          signIn: async () => {},
          signOut: async () => {},
          isAuthenticated: () => !!mockUser,
          token: () => null,
          setLoading: () => {}
        }}>
          <AuthButton {...props} />
        </AuthContext.Provider>
      );
    };
    
    const buttonContainer = solidStory(MockAuthButton, args);
    container.appendChild(buttonContainer);
    return container;
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<AuthButtonProps & { mockUser?: any; mockLoading?: boolean }>;

export const NotAuthenticated: Story = {
  args: {
    onSignInClick: () => console.log('Sign in clicked'),
    mockUser: null,
  },
};

export const AuthenticatedWithFarcaster: Story = {
  args: {
    mockUser: {
      id: '1',
      username: 'vitalik.eth',
      avatarUrl: 'https://i.imgur.com/KFfLXkA.jpg',
      credits: 1234,
    },
  },
};

export const AuthenticatedWithWallet: Story = {
  args: {
    mockUser: {
      id: '2',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA72',
      credits: 567,
    },
  },
};

export const AuthenticatedNoCredits: Story = {
  args: {
    mockUser: {
      id: '3',
      username: 'user123',
      avatarUrl: 'https://i.imgur.com/dMoIan7.jpg',
      credits: 0,
    },
  },
};

export const Loading: Story = {
  args: {
    mockLoading: true,
    mockUser: null,
  },
};

export const SmallSize: Story = {
  args: {
    size: 'sm',
    onSignInClick: () => console.log('Sign in clicked'),
    mockUser: null,
  },
};

export const SecondaryVariant: Story = {
  args: {
    variant: 'secondary',
    onSignInClick: () => console.log('Sign in clicked'),
    mockUser: null,
  },
};

export const GhostVariant: Story = {
  args: {
    variant: 'ghost',
    onSignInClick: () => console.log('Sign in clicked'),
    mockUser: null,
  },
};