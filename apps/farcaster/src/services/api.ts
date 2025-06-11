import { sdk } from '@farcaster/frame-sdk';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://scarlett-api-dev.deletion-backup782.workers.dev/api';

export interface DemoTokenResponse {
  token: string;
}

export interface UserCreditsResponse {
  credits: number;
  fid?: number;
}

export interface PurchaseCreditsRequest {
  fid: number;
  credits: number;
  transactionHash?: string;
  chain: 'Base' | 'Solana';
}

export interface PurchaseCreditsResponse {
  success: boolean;
  newBalance: number;
}

class ApiService {
  private authToken: string | null = null;

  async getDemoToken(): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/auth/demo`, {
        method: 'POST',
      });

      if (response.ok) {
        const data: DemoTokenResponse = await response.json();
        this.authToken = data.token;
        return data.token;
      }
      throw new Error('Failed to get demo token');
    } catch (error) {
      console.error('[ApiService] Failed to get demo token:', error);
      throw error;
    }
  }

  async getUserCredits(): Promise<UserCreditsResponse> {
    try {
      // Use Quick Auth if available
      const token = await sdk.quickAuth.getToken().catch(() => null);
      
      if (token) {
        const response = await sdk.quickAuth.fetch(`${API_BASE_URL}/user/credits`);
        if (response.ok) {
          return await response.json();
        }
      }
      
      // Fallback to demo credits
      return { credits: 100 };
    } catch (error) {
      console.error('[ApiService] Failed to get user credits:', error);
      return { credits: 0 };
    }
  }

  async purchaseCredits(request: PurchaseCreditsRequest): Promise<PurchaseCreditsResponse> {
    try {
      // In production, this would validate the transaction on-chain
      // For MVP, just simulate the purchase
      console.log('[ApiService] Simulating credit purchase:', request);
      
      // TODO: Implement actual purchase flow
      return {
        success: true,
        newBalance: request.credits,
      };
    } catch (error) {
      console.error('[ApiService] Failed to purchase credits:', error);
      throw error;
    }
  }

  async startKaraokeSession(trackId: string, songData: any) {
    const token = this.authToken || (await this.getDemoToken());
    
    const response = await fetch(`${API_BASE_URL}/karaoke/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ trackId, songData }),
    });

    if (!response.ok) {
      throw new Error('Failed to start karaoke session');
    }

    return response.json();
  }

  async gradeKaraokeLine(sessionId: string, lineData: any) {
    const token = this.authToken || (await this.getDemoToken());
    
    const response = await fetch(`${API_BASE_URL}/karaoke/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, ...lineData }),
    });

    if (!response.ok) {
      throw new Error('Failed to grade karaoke line');
    }

    return response.json();
  }
}

export const apiService = new ApiService();