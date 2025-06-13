// Core type definitions for Scarlett API

// Environment types
export interface Env {
  // Bindings
  DB: D1Database;
  
  // Environment variables
  ENVIRONMENT: 'development' | 'production' | 'test';
  
  // Secrets
  JWT_SECRET: string;
  GENIUS_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  VENICE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

// User types
export interface User {
  id: string;
  email: string;
  walletAddress?: string;
  displayName?: string;
  avatarUrl?: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  subscriptionExpiresAt?: string;
  trialExpiresAt?: string;
  creditsUsed: number;
  creditsLimit: number;
  creditsResetAt: string;
  unlockKeyId?: string;
  unlockLockAddress?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  isActive: boolean;
}

// JWT payload types
export interface JWTPayload {
  userId: string;
  email: string;
  walletAddress?: string;
  subscriptionStatus: string;
  creditsRemaining: number;
  type: 'extension_token' | 'api_key';
}

// Session types
export interface KaraokeSession {
  id: string;
  userId?: string;
  trackId: string;
  songTitle: string;
  songArtist: string;
  songGeniusId?: string;
  songDuration?: number;
  songDifficulty?: 'beginner' | 'intermediate' | 'advanced';
  currentLine: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  totalScore: number;
  linesCompleted: number;
  linesTotal: number;
  accuracyPercentage: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  creditsUsed: number;
}

// Song types
export interface Song {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  geniusId?: string;
  geniusUrl?: string;
  geniusConfidence?: number;
  soundcloudMatch?: boolean;
  artworkUrl?: string;
  language?: string;
  lyricsSource: 'genius' | 'lrclib' | 'manual';
  lyricsType: 'synced' | 'unsynced' | 'none';
  lyricsLinesCount: number;
  totalAttempts: number;
  totalCompletions: number;
  successRate: number;
  uniqueUsersAttempted: number;
  lastPlayedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Lyrics types
export interface LyricsLine {
  id: number;
  timestamp: number;
  text: string;
  duration: number;
  startTime: number;
  endTime: number;
  recordingStart?: number;
  recordingEnd?: number;
}

export interface LyricsData {
  source: 'genius' | 'lrclib';
  type: 'synced' | 'unsynced';
  lines: LyricsLine[];
  totalLines: number;
}

// Scoring types
export interface LineScore {
  lineIndex: number;
  expectedText: string;
  transcribedText: string;
  score: number;
  feedback: string;
  attemptNumber: number;
  confidence?: number;
  wordScores?: WordScore[];
}

export interface WordScore {
  word: string;
  score: number;
  matched: boolean;
  phoneticMatch: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Error types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public errors?: Record<string, string[]>) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_ERROR');
  }
}