import { BaseAuthProvider } from './base';
import type { User } from '@scarlett/core';

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

export class WalletAuthProvider extends BaseAuthProvider {
  private provider?: EthereumProvider;
  private address?: string;

  get type() {
    return 'wallet' as const;
  }

  getDisplayName(): string {
    return 'Wallet';
  }

  isAvailable(): boolean {
    // Check for injected wallet provider
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = window.ethereum as EthereumProvider;
      return true;
    }
    return false;
  }

  async login(): Promise<{ token: string; user: User }> {
    try {
      if (!this.provider) {
        throw new Error('No wallet provider available');
      }

      // Request accounts
      const accounts = await this.provider.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      this.address = accounts[0];

      // Sign message for authentication
      const message = `Sign this message to authenticate with Scarlett\nTimestamp: ${new Date().toISOString()}`;
      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, this.address],
      });

      // Send to backend for verification
      const response = await fetch(`${this.apiUrl}/auth/wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: this.address,
          message,
          signature,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with wallet');
      }

      const data = await response.json();
      return {
        token: data.token,
        user: data.user,
      };
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.address = undefined;
  }

  getAddress(): string | undefined {
    return this.address;
  }

  async switchChain(chainId: string): Promise<void> {
    if (!this.provider) {
      throw new Error('No wallet provider available');
    }

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        throw new Error('Please add this chain to your wallet');
      }
      throw error;
    }
  }
}