import type { ApiClient } from '../client';
import type {
  KaraokeData,
  KaraokeSession,
  LineScore,
  SessionResults,
  ApiResponse,
} from '@scarlett/core';

export class KaraokeEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * Fetch karaoke data for a track
   */
  async getData(trackId: string): Promise<KaraokeData> {
    return this.client.getKaraokeData(trackId);
  }

  /**
   * Start a new karaoke session
   */
  async startSession(
    trackId: string,
    songData: {
      title: string;
      artist: string;
      geniusId?: string;
      duration?: number;
      difficulty?: string;
    },
    songCatalogId?: string
  ): Promise<KaraokeSession> {
    const response = await this.client.startKaraokeSession({
      trackId,
      songData,
      songCatalogId,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start session');
    }

    return response.data;
  }

  /**
   * Grade a karaoke line recording
   */
  async gradeLine(
    sessionId: string,
    lineIndex: number,
    audioBase64: string,
    expectedText: string,
    startTime: number,
    endTime: number
  ): Promise<LineScore> {
    const response = await this.client.gradeKaraokeLine({
      sessionId,
      lineIndex,
      audioBuffer: audioBase64,
      expectedText,
      startTime,
      endTime,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to grade line');
    }

    return response.data;
  }

  /**
   * Complete a karaoke session
   */
  async completeSession(
    sessionId: string,
    fullAudioBase64?: string
  ): Promise<SessionResults> {
    const response = await this.client.completeKaraokeSession({
      sessionId,
      fullAudioBuffer: fullAudioBase64,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to complete session');
    }

    return response.data;
  }
}