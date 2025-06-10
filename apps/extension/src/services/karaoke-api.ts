export interface KaraokeData {
  success: boolean;
  track_id?: string;
  trackId?: string;
  has_karaoke?: boolean;
  hasKaraoke?: boolean;
  song?: {
    id: string;
    title: string;
    artist: string;
    album?: string;
    artworkUrl?: string;
    duration?: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  lyrics?: {
    source: string;
    type: 'synced';
    lines: LyricLine[];
    totalLines: number;
  };
  message?: string;
  error?: string;
  api_connected?: boolean;
}

export interface LyricLine {
  id: string;
  text: string;
  startTime: number;
  duration: number;
}

export interface KaraokeSession {
  id: string;
  trackId: string;
  songTitle: string;
  songArtist: string;
  status: string;
  createdAt: string;
}

export class KaraokeApiService {
  private baseUrl: string;

  constructor() {
    // Use the local server endpoint
    this.baseUrl = 'http://localhost:8787/api';
  }

  /**
   * Get karaoke data for a track ID (YouTube/SoundCloud)
   */
  async getKaraokeData(
    trackId: string, 
    title?: string, 
    artist?: string
  ): Promise<KaraokeData | null> {
    try {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (artist) params.set('artist', artist);
      
      const url = `${this.baseUrl}/karaoke/${encodeURIComponent(trackId)}${params.toString() ? '?' + params.toString() : ''}`;
      
      console.log('[KaraokeApi] Fetching karaoke data:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        // Remove Content-Type header to avoid CORS preflight
        // headers: {
        //   'Content-Type': 'application/json',
        // },
      });

      if (!response.ok) {
        console.error('[KaraokeApi] Failed to fetch karaoke data:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('[KaraokeApi] Received karaoke data:', data);
      
      // If there's an error but we got a response, it means API is connected
      if (data.error) {
        console.log('[KaraokeApi] Server error (but API is reachable):', data.error);
        return {
          success: false,
          has_karaoke: false,
          error: data.error,
          track_id: trackId,
          api_connected: true
        };
      }
      
      return data;
    } catch (error) {
      console.error('[KaraokeApi] Error fetching karaoke data:', error);
      return null;
    }
  }

  /**
   * Start a karaoke session
   */
  async startSession(
    trackId: string,
    songData: {
      title: string;
      artist: string;
      album?: string;
      duration?: number;
    }
  ): Promise<KaraokeSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/karaoke/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add auth token when available
        },
        body: JSON.stringify({
          trackId,
          songData,
        }),
      });

      if (!response.ok) {
        console.error('[KaraokeApi] Failed to start session:', response.status);
        return null;
      }

      const result = await response.json();
      return result.session;
    } catch (error) {
      console.error('[KaraokeApi] Error starting session:', error);
      return null;
    }
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
      return response.ok;
    } catch (error) {
      console.error('[KaraokeApi] Connection test failed:', error);
      return false;
    }
  }
}

export const karaokeApi = new KaraokeApiService();