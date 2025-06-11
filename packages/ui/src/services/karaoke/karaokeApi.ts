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
    songData: { title: string; artist: string; genius_id?: string },
    authToken: string
  ): Promise<KaraokeSession | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/karaoke/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          track_id: trackId,
          song_data: songData,
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
    audioData: string,
    expectedText: string,
    attemptNumber: number,
    authToken: string
  ): Promise<LineScore | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/karaoke/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          line_index: lineIndex,
          audio_data: audioData,
          expected_text: expectedText,
          attempt_number: attemptNumber,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          score: Math.round(result.score),
          feedback: result.feedback,
          attempts: result.attempts,
          wordTimings: result.word_timings,
          wordScores: result.word_scores,
          transcriptionConfidence: result.transcription_confidence,
          transcript: result.transcript,
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
    sessionAudioData: string,
    lyricsWithTiming: any[],
    authToken: string
  ): Promise<SessionResults | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/karaoke/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          audio_data: sessionAudioData,
          lyrics_with_timing: lyricsWithTiming,
        }),
      });

      if (response.ok) {
        return await response.json();
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
        `${this.serverUrl}/api/users/me/songs/${songId}/best-score`,
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
        `${this.serverUrl}/api/songs/${songId}/leaderboard?limit=${limit}`
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