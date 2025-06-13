import { sdk } from '@farcaster/frame-sdk';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

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
      const response = await fetch(`${API_BASE_URL}/auth/demo`, {
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
        const response = await sdk.quickAuth.fetch(`${API_BASE_URL}/api/user/credits`);
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
    
    const response = await fetch(`${API_BASE_URL}/api/karaoke/start`, {
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
    
    const response = await fetch(`${API_BASE_URL}/api/karaoke/grade`, {
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

  async getKaraokeData(trackId: string, title?: string, artist?: string) {
    const token = this.authToken || (await this.getDemoToken());
    
    // Don't encode the trackId since it contains path separators
    const url = new URL(`${API_BASE_URL}/api/karaoke/${trackId}`);
    if (title) url.searchParams.set('title', title);
    if (artist) url.searchParams.set('artist', artist);
    
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get karaoke data');
    }

    return response.json();
  }

  async searchSongs(query: string, limit: number = 20, offset: number = 0) {
    const url = new URL(`${API_BASE_URL}/api/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());
    
    console.log('[ApiService] Searching:', url.toString());
    
    const response = await fetch(url.toString());
    console.log('[ApiService] Search response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[ApiService] Search error:', error);
      throw new Error('Failed to search songs');
    }

    const data = await response.json();
    console.log('[ApiService] Search data:', data);
    return data;
  }

  async getUserStreak(userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/streak`);
      
      if (!response.ok) {
        console.warn('Failed to get user streak, using defaults');
        return {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
          completedToday: false
        };
      }

      const data = await response.json();
      return data.data || {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
        completedToday: false
      };
    } catch (error) {
      console.error('Error fetching user streak:', error);
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
        completedToday: false
      };
    }
  }

  async getUserRankings(userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/rankings`);
      
      if (!response.ok) {
        console.warn('Failed to get user rankings, using defaults');
        return {
          rankings: [],
          hasTopPosition: false
        };
      }

      const data = await response.json();
      return data.data || {
        rankings: [],
        hasTopPosition: false
      };
    } catch (error) {
      console.error('Error fetching user rankings:', error);
      return {
        rankings: [],
        hasTopPosition: false
      };
    }
  }

  async savePerformance(performanceData: {
    userId: string;
    songCatalogId: string;
    score: number;
    accuracy?: number;
    sessionDurationMs?: number;
    linesCompleted?: number;
    totalLines?: number;
    timezone?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/api/performances/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(performanceData),
    });

    if (!response.ok) {
      throw new Error('Failed to save performance');
    }

    const data = await response.json();
    return data.data;
  }

  async translateLyric(text: string, targetLang: 'en' | 'es'): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${API_BASE_URL}/api/lyrics/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return response.body;
  }

  async annotateLyric(text: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/lyrics/annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Annotation failed');
    }

    const data = await response.json();
    return data.annotations || [];
  }
}

export const apiService = new ApiService();