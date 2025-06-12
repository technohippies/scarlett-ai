import type { KaraokeData, KaraokeSession, LineScore, SessionResults } from '../../types/karaoke';

export class KaraokeApiService {
  constructor(private serverUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:8787') {}

  async fetchKaraokeData(
    trackId: string,
    title?: string,
    artist?: string
  ): Promise<KaraokeData | null> {
    try {
      const url = new URL(`${this.serverUrl}/api/karaoke/${trackId}`);
      if (title) url.searchParams.set('title', title);
      if (artist) url.searchParams.set('artist', artist);

      const response = await fetch(url.toString());
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('[KaraokeApi] Failed to fetch karaoke data:', error);
      return null;
    }
  }

  async startSession(
    trackId: string,
    songData: { title: string; artist: string; geniusId?: string; duration?: number; difficulty?: string },
    authToken?: string,
    songCatalogId?: string,
    playbackSpeed?: string
  ): Promise<KaraokeSession | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.serverUrl}/karaoke/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trackId,
          songData,
          songCatalogId,
          playbackSpeed,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.session;
      }
      
      console.error('[KaraokeApi] Failed to start session:', response.status, await response.text());
      return null;
    } catch (error) {
      console.error('[KaraokeApi] Failed to start session:', error);
      return null;
    }
  }

  async gradeRecording(
    sessionId: string,
    lineIndex: number,
    audioBuffer: string,
    expectedText: string,
    startTime: number,
    endTime: number,
    authToken?: string,
    playbackSpeed?: string
  ): Promise<LineScore | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.serverUrl}/karaoke/grade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          lineIndex,
          audioBuffer,
          expectedText,
          startTime,
          endTime,
          playbackSpeed,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          score: Math.round(result.score),
          feedback: result.feedback,
          transcript: result.transcription,
          wordScores: result.wordScores,
        };
      }
      return null;
    } catch (error) {
      console.error('[KaraokeApi] Failed to grade recording:', error);
      return null;
    }
  }

  async completeSession(
    sessionId: string,
    fullAudioBuffer?: string,
    authToken?: string
  ): Promise<SessionResults | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.serverUrl}/karaoke/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          fullAudioBuffer,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: result.success,
          finalScore: result.finalScore,
          totalLines: result.totalLines,
          perfectLines: result.perfectLines,
          goodLines: result.goodLines,
          needsWorkLines: result.needsWorkLines,
          accuracy: result.accuracy,
          sessionId: result.sessionId,
        };
      }
      return null;
    } catch (error) {
      console.error('[KaraokeApi] Failed to complete session:', error);
      return null;
    }
  }

  async getUserBestScore(songId: string, authToken: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.serverUrl}/users/me/songs/${songId}/best-score`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.bestScore || null;
      }
      
      if (response.status === 404) {
        return null;
      }
      
      throw new Error('Failed to fetch best score');
    } catch (error) {
      console.error('[KaraokeApi] Failed to fetch user best score:', error);
      return null;
    }
  }

  async getSongLeaderboard(songId: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.serverUrl}/songs/${songId}/leaderboard?limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.entries || [];
      }
      return [];
    } catch (error) {
      console.error('[KaraokeApi] Failed to fetch leaderboard:', error);
      return [];
    }
  }
}