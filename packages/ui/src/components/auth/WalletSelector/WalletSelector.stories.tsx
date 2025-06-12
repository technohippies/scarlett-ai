import type { Meta, StoryObj } from 'storybook-solidjs';
import { WalletSelector } from './WalletSelector';
import { createSignal } from 'solid-js';

const meta = {
  title: 'Components/Auth/WalletSelector',
  component: WalletSelector,
  tags: ['autodocs'],
} satisfies Meta<typeof WalletSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onConnect: (walletId) => console.log('Connect:', walletId),
  },
};

export const WithBackButton: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onBack: () => console.log('Back'),
    onConnect: (walletId) => console.log('Connect:', walletId),
  },
};

export const Connecting: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onConnect: (walletId) => console.log('Connect:', walletId),
    connecting: true,
    connectedWallet: 'metamask',
  },
};

export const Connected: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onConnect: (walletId) => console.log('Connect:', walletId),
    connectedWallet: 'walletconnect',
  },
};

export const WithError: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onConnect: (walletId) => console.log('Connect:', walletId),
    error: 'Failed to connect wallet. Please try again.',
  },
};

export const SomeWalletsUnavailable: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close'),
    onConnect: (walletId) => console.log('Connect:', walletId),
    wallets: [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: (props: any) => <div class={props.class}>M</div>,
        available: true,
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        icon: (props: any) => <div class={props.class}>W</div>,
        available: false,
      },
      {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: (props: any) => <div class={props.class}>C</div>,
        available: true,
      },
    ],
  },
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    const [connecting, setConnecting] = createSignal(false);
    const [connectedWallet, setConnectedWallet] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);

    const handleConnect = async (walletId: string) => {
      setError(null);
      setConnecting(true);
      setConnectedWallet(walletId);
      
      // Simulate connection
      setTimeout(() => {
        setConnecting(false);
        // Simulate random error
        if (Math.random() > 0.7) {
          setError('Connection failed. Please try again.');
          setConnectedWallet(null);
        } else {
          console.log('Connected to:', walletId);
          // In real app, this would close modal and proceed
          setTimeout(() => setOpen(false), 1000);
        }
      }, 2000);
    };

    return (
      <div class="p-8">
        <button
          onClick={() => setOpen(true)}
          class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          Open Wallet Selector
        </button>
        
        <WalletSelector
          open={open()}
          onClose={() => setOpen(false)}
          onConnect={handleConnect}
          connecting={connecting()}
          connectedWallet={connectedWallet()}
          error={error()}
        />
      </div>
    );
  },
};