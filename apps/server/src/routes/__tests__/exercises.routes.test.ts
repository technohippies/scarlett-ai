import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types';
import { exercisesRoutes } from '../exercises.routes';

// Mock Venice service
vi.mock('../../services/venice.service', () => ({
  createVeniceService: vi.fn(() => ({
    complete: vi.fn().mockResolvedValue(JSON.stringify([
      {
        type: 'mcq',
        question: 'Which pronunciation is correct for "stronger"?',
        options: [
          { id: 'a', text: 'stron-ger' },
          { id: 'b', text: 'strong-er' },
          { id: 'c', text: 'stron-gah' },
          { id: 'd', text: 'strong-uh' }
        ],
        correctOptionId: 'b'
      },
      {
        type: 'read-aloud',
        prompt: 'Practice saying this phrase:',
        expectedText: 'What doesn\'t kill you makes you stronger'
      }
    ]))
  }))
}));

describe('Exercises Routes', () => {
  let app: Hono<{ Bindings: Env }>;
  
  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/api/exercises', exercisesRoutes);
  });

  describe('POST /api/exercises/generate', () => {
    it('should generate exercises for pronunciation errors', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret',
        VENICE_API_KEY: 'test-key'
      };

      const req = new Request('http://localhost/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: [
            { expected: 'stronger', actual: 'stronga', score: 45 },
            { expected: 'What doesn\'t kill you', actual: 'What don\'t kill you', score: 60 },
            { expected: 'n-n-now', actual: 'net net net', score: 80 } // STT error, should be filtered
          ],
          songInfo: {
            title: 'Stronger',
            artist: 'Kanye West'
          }
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.exercises).toHaveLength(2);
      expect(data.processedErrors).toBe(2); // n-n-now filtered out
      expect(data.totalErrors).toBe(3);
    });

    it('should filter out STT errors and slang variations', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret',
        VENICE_API_KEY: 'test-key'
      };

      const req = new Request('http://localhost/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: [
            { expected: 'hurtin\'', actual: 'hurting', score: 75 }, // Slang variation, high score
            { expected: 'ttttthat', actual: 'that', score: 85 }, // STT artifact
            { expected: 'really', actual: 'weally', score: 30 } // Real error
          ]
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.processedErrors).toBe(1); // Only 'really' -> 'weally'
    });

    it('should return empty exercises when all errors are filtered', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret',
        VENICE_API_KEY: 'test-key'
      };

      const req = new Request('http://localhost/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: [
            { expected: 'gonna', actual: 'going to', score: 90 },
            { expected: 'wanna', actual: 'want to', score: 85 }
          ]
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.exercises).toHaveLength(0);
      expect(data.message).toContain('Great job');
    });

    it('should return 400 for empty errors', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret',
        VENICE_API_KEY: 'test-key'
      };

      const req = new Request('http://localhost/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: [] })
      });

      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(400);
    });

    it('should return 503 when Venice service is not configured', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret'
        // No VENICE_API_KEY
      };

      const req = new Request('http://localhost/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: [{ expected: 'test', actual: 'best', score: 40 }]
        })
      });

      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/exercises/validate', () => {
    it('should validate MCQ answer correctly', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret'
      };

      const req = new Request('http://localhost/api/exercises/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: {
            type: 'mcq',
            correctOptionId: 'b',
            options: [
              { id: 'a', text: 'Wrong' },
              { id: 'b', text: 'Correct' }
            ]
          },
          userResponse: 'b'
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.correct).toBe(true);
      expect(data.feedback).toBe('Correct!');
    });

    it('should validate incorrect MCQ answer', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret'
      };

      const req = new Request('http://localhost/api/exercises/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: {
            type: 'mcq',
            correctOptionId: 'b',
            options: [
              { id: 'a', text: 'Wrong' },
              { id: 'b', text: 'Correct' }
            ]
          },
          userResponse: 'a'
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.correct).toBe(false);
      expect(data.feedback).toContain('The correct answer was: Correct');
    });

    it('should validate read-aloud exercise', async () => {
      const mockEnv: Env = {
        ENVIRONMENT: 'test',
        DB: {} as D1Database,
        JWT_SECRET: 'test-secret'
      };

      const req = new Request('http://localhost/api/exercises/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: {
            type: 'read-aloud',
            expectedText: 'Test phrase'
          },
          userResponse: 'Test phrase'
        })
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.correct).toBe(true);
      expect(data.feedback).toContain('Good job');
    });
  });
});