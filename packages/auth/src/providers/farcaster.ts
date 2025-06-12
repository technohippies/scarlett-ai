import { BaseAuthProvider } from './base';
import type { User } from '@scarlett/core';
import type { ApiClientConfig } from '@scarlett/api-client';
import { createApiClient } from '@scarlett/api-client';

// Farcaster SDK types (minimal subset)
interface FarcasterSDK {
  isInMiniApp(): boolean;
  quickAuth: {
    getToken(): Promise<string>;
    fetch(url: string, options?: RequestInit): Promise<Response>;
  };
  context?: {
    user?: {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl?: string;
    };
  };
}

export class FarcasterAuthProvider extends BaseAuthProvider {
  private sdk: FarcasterSDK;
  private apiClient: ReturnType<typeof createApiClient>;

  constructor(config: { sdk: FarcasterSDK } & ApiClientConfig) {
    super(config);
    this.sdk = config.sdk;
    this.apiClient = createApiClient(config);
  }

  get type() {
    return 'farcaster' as const;
  }

  getDisplayName(): string {
    return 'Farcaster';
  }

  isAvailable(): boolean {
    return this.sdk.isInMiniApp();
  }

  async login(): Promise<{ token: string; user: User }> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Farcaster SDK not available');
      }

      // Get Farcaster Quick Auth token
      const farcasterToken = await this.sdk.quickAuth.getToken();
      
      // Exchange for app token
      const response = await fetch(`${this.apiUrl}/auth/farcaster`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${farcasterToken}`,
        },
        body: JSON.stringify({
          fid: this.sdk.context?.user?.fid,
          username: this.sdk.context?.user?.username,
          displayName: this.sdk.context?.user?.displayName,
          pfpUrl: this.sdk.context?.user?.pfpUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with Farcaster');
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
    // Farcaster doesn't have explicit logout
    // Just clear local state
  }

  // Helper method for Farcaster Quick Auth fetch
  async quickAuthFetch(url: string, options?: RequestInit): Promise<Response> {
    return this.sdk.quickAuth.fetch(url, options);
  }
}