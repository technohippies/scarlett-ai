import type { Env } from '../types';

export interface Config {
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  jwt: {
    extensionTokenExpiry: string;
    apiKeyExpiry: string;
    algorithm: string;
  };
  credits: {
    trialCredits: number;
    monthlyCredits: number;
    sessionCost: number;
  };
  limits: {
    maxSessionDuration: number; // minutes
    maxFileSize: number; // bytes
    maxLyricsLines: number;
  };
}

export function getConfig(env: Env): Config {
  const isDevelopment = env.ENVIRONMENT === 'development';

  return {
    cors: {
      origins: isDevelopment
        ? [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:3002',
            'http://localhost:3003',
            'http://127.0.0.1:3000',
            'https://sc.maid.zone',
            'chrome-extension://*',
          ]
        : [
            'https://scarlettx.xyz',
            'https://sc.maid.zone',
            'chrome-extension://*', // Chrome extension support
          ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: false,
    },
    jwt: {
      extensionTokenExpiry: '7d',
      apiKeyExpiry: '1y',
      algorithm: 'HS256',
    },
    credits: {
      trialCredits: 100,
      monthlyCredits: 500,
      sessionCost: 1,
    },
    limits: {
      maxSessionDuration: 30, // 30 minutes
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxLyricsLines: 500,
    },
  };
}

// Export convenience helpers
export const ENDPOINTS = {
  health: '/api/health',
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    me: '/auth/me',
    refresh: '/auth/refresh',
    farcaster: '/api/auth/farcaster',
  },
  karaoke: {
    match: '/api/karaoke/:trackId',
    start: '/api/karaoke/start',
    grade: '/api/karaoke/grade',
    gradeSession: '/api/karaoke/grade-session',
    session: '/api/karaoke/session/:sessionId',
  },
  songs: {
    popular: '/api/songs/popular',
    trending: '/api/songs/trending',
    details: '/api/songs/:songId',
    leaderboard: '/api/songs/:songId/leaderboard',
  },
  tutor: {
    analyze: '/api/tutor/analyze',
    tts: '/api/tutor/tts',
    stt: '/api/tutor/exercise-stt',
  },
  audio: {
    proxy: '/api/audio/proxy/:trackId',
  },
} as const;