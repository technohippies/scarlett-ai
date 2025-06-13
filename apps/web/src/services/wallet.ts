import { createAppKit } from '@reown/appkit';
import { mainnet, base, baseSepolia } from '@reown/appkit/networks';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { createSignal } from 'solid-js';
import { BrowserProvider } from 'ethers';

// Project configuration
// Using a test project ID for development - replace with your own for production
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '2c8e14aa0b3c84a96d029f6e7df0b81e';

// Chains configuration
const chains = [base, mainnet, baseSepolia];

// Metadata
const metadata = {
  name: 'Scarlett',
  description: 'Learn languages through music',
  url: window.location.origin,
  icons: ['/logo.png']
};

// Create ethers adapter
const ethersAdapter = new EthersAdapter();

// Create AppKit instance
export const appKit = createAppKit({
  projectId,
  networks: chains as any, // Type casting for compatibility
  adapters: [ethersAdapter],
  metadata,
  features: {
    analytics: true,
    allWallets: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '--w3m-accent': '#7c5efa',
    '--w3m-border-radius-master': '8px'
  }
});

// Wallet state management
export const [address, setAddress] = createSignal<string | undefined>(undefined);
export const [isConnected, setIsConnected] = createSignal(false);
export const [chainId, setChainId] = createSignal<number | undefined>(undefined);

// Subscribe to wallet events
appKit.subscribeAccount((account: any) => {
  setAddress(account.address);
  setIsConnected(account.isConnected);
  if (account.caipNetwork) {
    const chainIdMatch = account.caipNetwork.chainId.match(/\d+/);
    setChainId(chainIdMatch ? parseInt(chainIdMatch[0]) : undefined);
  }
});

// Utility functions
export const connectWallet = async () => {
  try {
    await appKit.open();
  } catch (error) {
    console.error('Failed to connect wallet:', error);
  }
};

export const disconnectWallet = async () => {
  try {
    await appKit.disconnect();
  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
  }
};

export const getProvider = () => {
  // Access provider from window.ethereum or connected wallet
  if (typeof window !== 'undefined' && window.ethereum) {
    return new BrowserProvider(window.ethereum as any);
  }
  return null;
};

export const getSigner = async () => {
  const provider = getProvider();
  if (!provider) throw new Error('No provider available');
  return provider.getSigner();
};

// SIWF (Sign In With Farcaster) support
export const signInWithFarcaster = async (fid: number, message?: string) => {
  const signer = await getSigner();
  const defaultMessage = `Sign in to Scarlett with Farcaster ID: ${fid}\n\nTimestamp: ${Date.now()}`;
  const signature = await signer.signMessage(message || defaultMessage);
  return signature;
};