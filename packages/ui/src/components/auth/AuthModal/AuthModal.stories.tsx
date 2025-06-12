import type { Meta, StoryObj } from 'storybook-solidjs';
import { AuthModal } from './AuthModal';
import { AuthProvider } from '@scarlett/auth';
import { createSignal } from 'solid-js';

const meta = {
  title: 'Components/Auth/AuthModal',
  component: AuthModal,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      const mockAuth = {
        user: () => null,
        isLoading: () => false,
        signIn: async (provider: string) => {
          console.log('Sign in with:', provider);
          // Simulate async sign in
          return new Promise((resolve) => setTimeout(resolve, 1000));
        },
        signOut: async () => {},
        isAuthenticated: () => false,
      };

      return (
        <AuthProvider value={mockAuth}>
          <Story />
        </AuthProvider>
      );
    },
  ],
} satisfies Meta<typeof AuthModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
    onWalletConnect: () => console.log('Connect wallet clicked'),
  },
};

export const WithDemoMode: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
    onWalletConnect: () => console.log('Connect wallet clicked'),
    enableDemoMode: true,
  },
};

export const LoadingState: Story = {
  decorators: [
    (Story) => {
      const [isLoading] = createSignal(true);
      
      const mockAuth = {
        user: () => null,
        isLoading,
        signIn: async () => {
          // Simulate loading
          await new Promise(() => {});
        },
        signOut: async () => {},
        isAuthenticated: () => false,
      };

      return (
        <AuthProvider value={mockAuth}>
          <Story />
        </AuthProvider>
      );
    },
  ],
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
  },
};

export const WithError: Story = {
  decorators: [
    (Story) => {
      const mockAuth = {
        user: () => null,
        isLoading: () => false,
        signIn: async () => {
          throw new Error('Authentication failed');
        },
        signOut: async () => {},
        isAuthenticated: () => false,
      };

      return (
        <AuthProvider value={mockAuth}>
          <Story />
        </AuthProvider>
      );
    },
  ],
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
  },
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    
    return (
      <div class="p-8">
        <button
          onClick={() => setOpen(true)}
          class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          Open Auth Modal
        </button>
        
        <AuthModal
          open={open()}
          onClose={() => setOpen(false)}
          onWalletConnect={() => {
            console.log('Connect wallet');
            // In real app, this would open wallet selector
          }}
          enableDemoMode={true}
        />
      </div>
    );
  },
};