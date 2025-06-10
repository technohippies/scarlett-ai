import { describe, it, expect, beforeAll } from 'vitest';
import app from '../index';
import { createTestEnv, createTestUser, createTestToken } from '../test/helpers';

describe('Karaoke Integration Tests', () => {
  let env: ReturnType<typeof createTestEnv>;
  let testUser: ReturnType<typeof createTestUser>;
  let authToken: string;

  beforeAll(async () => {
    env = createTestEnv();
    testUser = createTestUser();
    authToken = await createTestToken(testUser, env);
  });

  describe('Complete karaoke flow', () => {
    it('should handle full karaoke session lifecycle', async () => {
      // 1. Get karaoke data for a track
      const trackId = 'test-track-123';
      const karaokeResponse = await app.fetch(
        new Request(`http://localhost/api/karaoke/${trackId}?title=Test Song&artist=Test Artist`),
        env
      );

      expect(karaokeResponse.status).toBe(200);
      const karaokeData = await karaokeResponse.json();
      
      // If no karaoke available, skip rest of test
      if (!karaokeData.hasKaraoke) {
        console.log('No karaoke data available for test track');
        return;
      }

      // 2. Start a karaoke session
      const startResponse = await app.fetch(
        new Request('http://localhost/api/karaoke/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            trackId,
            songData: {
              title: 'Test Song',
              artist: 'Test Artist',
            },
          }),
        }),
        env
      );

      expect(startResponse.status).toBe(200);
      const startData = await startResponse.json();
      expect(startData.sessionId).toBeTruthy();

      const sessionId = startData.sessionId;

      // 3. Grade a line
      const gradeResponse = await app.fetch(
        new Request('http://localhost/api/karaoke/grade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            sessionId,
            lineIndex: 0,
            audioData: btoa('mock-audio-data'), // Base64 encoded
            expectedText: 'Hello world',
            attemptNumber: 1,
          }),
        }),
        env
      );

      expect(gradeResponse.status).toBe(200);
      const gradeData = await gradeResponse.json();
      expect(gradeData.score).toBeGreaterThanOrEqual(0);
      expect(gradeData.score).toBeLessThanOrEqual(100);
      expect(gradeData.feedback).toBeTruthy();

      // 4. Get session details
      const sessionResponse = await app.fetch(
        new Request(`http://localhost/api/karaoke/session/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }),
        env
      );

      expect(sessionResponse.status).toBe(200);
      const sessionData = await sessionResponse.json();
      expect(sessionData.session.id).toBe(sessionId);
      expect(sessionData.session.lineScores).toHaveLength(1);

      // 5. Complete the session
      const completeResponse = await app.fetch(
        new Request(`http://localhost/api/karaoke/session/${sessionId}/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }),
        env
      );

      expect(completeResponse.status).toBe(200);
      const completeData = await completeResponse.json();
      expect(completeData.overallScore).toBeDefined();
      expect(completeData.linesCompleted).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid session gracefully', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/karaoke/grade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            sessionId: 'invalid-session-id',
            lineIndex: 0,
            audioData: btoa('mock-audio-data'),
            expectedText: 'Hello world',
            attemptNumber: 1,
          }),
        }),
        env
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('should require authentication for protected endpoints', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/karaoke/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: 'test-track',
            songData: {
              title: 'Test Song',
              artist: 'Test Artist',
            },
          }),
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});