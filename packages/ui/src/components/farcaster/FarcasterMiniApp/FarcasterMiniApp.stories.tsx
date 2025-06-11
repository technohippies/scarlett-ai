import type { Meta, StoryObj } from '@storybook/html';
import { FarcasterMiniApp, type FarcasterMiniAppProps } from './FarcasterMiniApp';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<FarcasterMiniAppProps> = {
  title: 'Farcaster/FarcasterMiniApp',
  render: solidStory(FarcasterMiniApp),
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    userCredits: {
      control: { type: 'number' },
    },
    isWalletConnected: {
      control: 'boolean',
    },
    walletChain: {
      control: 'select',
      options: ['Base', 'Solana'],
    },
  },
};

export default meta;
type Story = StoryObj<FarcasterMiniAppProps>;

export const NewUser: Story = {
  args: {
    user: {
      fid: 3621,
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    },
    userCredits: 0,
    isWalletConnected: false,
    onConnectWallet: () => console.log('Connect wallet'),
    onPurchaseCredits: (pack) => console.log('Purchase pack:', pack),
  },
};

export const WalletConnected: Story = {
  args: {
    user: {
      fid: 3621,
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    },
    userCredits: 0,
    isWalletConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    walletChain: 'Base',
    onDisconnectWallet: () => console.log('Disconnect wallet'),
    onPurchaseCredits: (pack) => console.log('Purchase pack:', pack),
  },
};

export const WithCredits: Story = {
  args: {
    user: {
      fid: 3621,
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    },
    userCredits: 500,
    isWalletConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    walletChain: 'Base',
    onSelectSong: () => console.log('Select song'),
  },
};

export const AnonymousUser: Story = {
  args: {
    userCredits: 0,
    isWalletConnected: false,
    onConnectWallet: () => console.log('Connect wallet'),
  },
};

export const MobileView: Story = {
  args: {
    user: {
      fid: 3621,
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    },
    userCredits: 250,
    isWalletConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    walletChain: 'Base',
  },
  decorators: [
    (Story) => {
      const wrapper = document.createElement('div');
      wrapper.style.width = '375px';
      wrapper.style.height = '812px';
      wrapper.style.margin = '0 auto';
      wrapper.style.border = '1px solid #333';
      wrapper.style.borderRadius = '20px';
      wrapper.style.overflow = 'hidden';
      wrapper.appendChild(Story());
      return wrapper;
    },
  ],
};

export const DesktopView: Story = {
  args: {
    user: {
      fid: 3621,
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    },
    userCredits: 1200,
    isWalletConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    walletChain: 'Base',
  },
  decorators: [
    (Story) => {
      const wrapper = document.createElement('div');
      wrapper.style.width = '424px';
      wrapper.style.height = '695px';
      wrapper.style.margin = '0 auto';
      wrapper.style.boxShadow = '0 0 24px rgba(0, 0, 0, 0.2)';
      wrapper.style.overflow = 'hidden';
      wrapper.appendChild(Story());
      return wrapper;
    },
  ],
};