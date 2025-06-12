import { createApiClient, type ScarlettApiClient } from '@scarlett/api-client';
import type { KaraokeData, KaraokeSession, LineScore, SessionResults } from '@scarlett/core';

/**
 * Adapter class that provides the same interface as the old KaraokeApiService
 * but uses the new @scarlett/api-client under the hood
 */
export class KaraokeApiService {
  private client: ScarlettApiClient;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:8787') {
    this.client = createApiClient({ baseUrl });
  }

  async fetchKaraokeData(trackId: string): Promise<KaraokeData | null> {
    try {
      return await this.client.karaoke.getData(trackId);
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
      // Note: playbackSpeed is stored but not used by the current api-client
      // This maintains compatibility with the existing interface
      const session = await this.client.karaoke.startSession(
        trackId,
        songData,
        songCatalogId
      );
      return session;
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
      // Note: playbackSpeed is passed but not used by the current api-client
      const lineScore = await this.client.karaoke.gradeLine(
        sessionId,
        lineIndex,
        audioBuffer,
        expectedText,
        startTime,
        endTime
      );
      return lineScore;
    } catch (error) {
      console.error('[KaraokeApi] Failed to grade recording:', error);
      return null;
    }
  }

  async completeSession(
    sessionId: string,
    fullAudioBuffer?: string
  ): Promise<SessionResults | null> {
    try {
      const results = await this.client.karaoke.completeSession(
        sessionId,
        fullAudioBuffer
      );
      return results;
    } catch (error) {
      console.error('[KaraokeApi] Failed to complete session:', error);
      return null;
    }
  }

  async getUserBestScore(songId: string): Promise<number | null> {
    try {
      const response = await this.client.client.getUserBestScore(songId);
      return response.data?.score ?? null;
    } catch (error) {
      console.error('[KaraokeApi] Failed to get user best score:', error);
      return null;
    }
  }

  async getSongLeaderboard(songId: string, limit = 10): Promise<Array<{ userId: string; score: number; rank: number }>> {
    try {
      const response = await this.client.client.getSongLeaderboard(songId, limit);
      return response.data ?? [];
    } catch (error) {
      console.error('[KaraokeApi] Failed to get song leaderboard:', error);
      return [];
    }
  }
}