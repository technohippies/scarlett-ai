import type {
  ApiResponse,
  StartSessionRequest,
  GradeLineRequest,
  CompleteSessionRequest,
  TranscribeRequest,
  TranscribeResponse,
  KaraokeData,
  KaraokeSession,
  LineScore,
  SessionResults,
  DemoTokenResponse,
  UserCreditsResponse,
  PurchaseCreditsRequest,
  PurchaseCreditsResponse,
  Exercise,
  PracticeCard,
} from '@scarlett/core';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
  onError?: (error: Error) => void;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;
  private onError?: (error: Error) => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getAuthToken = config.getAuthToken;
    this.onError = config.onError;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add auth token if available
      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }

  // Auth endpoints
  async getDemoToken(): Promise<string> {
    const response = await this.request<DemoTokenResponse>('/auth/demo', {
      method: 'POST',
    });
    return response.token;
  }

  async getUserCredits(): Promise<UserCreditsResponse> {
    return this.request<UserCreditsResponse>('/api/user/credits');
  }

  async purchaseCredits(
    request: PurchaseCreditsRequest
  ): Promise<PurchaseCreditsResponse> {
    return this.request<PurchaseCreditsResponse>('/api/user/credits/purchase', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Karaoke endpoints
  async getKaraokeData(trackId: string): Promise<KaraokeData> {
    return this.request<KaraokeData>(`/api/karaoke/${encodeURIComponent(trackId)}`);
  }

  async startKaraokeSession(
    request: StartSessionRequest
  ): Promise<ApiResponse<KaraokeSession>> {
    return this.request<ApiResponse<KaraokeSession>>('/api/karaoke/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async gradeKaraokeLine(
    request: GradeLineRequest
  ): Promise<ApiResponse<LineScore>> {
    return this.request<ApiResponse<LineScore>>('/api/karaoke/grade', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async completeKaraokeSession(
    request: CompleteSessionRequest
  ): Promise<ApiResponse<SessionResults>> {
    return this.request<ApiResponse<SessionResults>>('/api/karaoke/complete', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Speech-to-text endpoints
  async transcribeAudio(
    request: TranscribeRequest
  ): Promise<TranscribeResponse> {
    return this.request<TranscribeResponse>('/api/speech-to-text/transcribe', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Practice endpoints
  async getPracticeExercises(
    sessionId?: string,
    limit = 10
  ): Promise<ApiResponse<{ exercises: Exercise[]; cards: PracticeCard[] }>> {
    const params = new URLSearchParams();
    if (sessionId) params.append('sessionId', sessionId);
    params.append('limit', limit.toString());

    return this.request<ApiResponse<{ exercises: Exercise[]; cards: PracticeCard[] }>>(
      `/api/practice/exercises?${params}`
    );
  }

  async submitPracticeReview(
    cardId: string,
    score: number,
    reviewTime: string
  ): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/practice/review', {
      method: 'POST',
      body: JSON.stringify({ cardId, score, reviewTime }),
    });
  }

  // User endpoints
  async getUserBestScore(songId: string): Promise<ApiResponse<{ score: number }>> {
    return this.request<ApiResponse<{ score: number }>>(
      `/api/users/me/songs/${songId}/best-score`
    );
  }

  // Leaderboard endpoints
  async getSongLeaderboard(
    songId: string,
    limit = 10
  ): Promise<ApiResponse<Array<{ userId: string; score: number; rank: number }>>> {
    return this.request<ApiResponse<Array<{ userId: string; score: number; rank: number }>>>(
      `/api/songs/${songId}/leaderboard?limit=${limit}`
    );
  }
}