import type { Meta, StoryObj } from '@storybook/html';
import { WalletConnect, type WalletConnectProps } from './WalletConnect';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<WalletConnectProps> = {
  title: 'Web/WalletConnect',
  render: solidStory(WalletConnect),
  argTypes: {
    address: {
      control: { type: 'text' },
    },
    chain: {
      control: 'select',
      options: ['Base', 'Solana'],
    },
    isConnected: {
      control: 'boolean',
    },
    isConnecting: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<WalletConnectProps>;

export const Disconnected: Story = {
  args: {
    isConnected: false,
    onConnect: () => console.log('Connect wallet'),
  },
};

export const Connecting: Story = {
  args: {
    isConnected: false,
    isConnecting: true,
  },
};

export const ConnectedBase: Story = {
  args: {
    isConnected: true,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'Base',
    onDisconnect: () => console.log('Disconnect wallet'),
  },
};

export const ConnectedSolana: Story = {
  args: {
    isConnected: true,
    address: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
    chain: 'Solana',
    onDisconnect: () => console.log('Disconnect wallet'),
  },
};