// Core karaoke types used across the application

export interface KaraokeData {
  track_id: string;
  has_karaoke: boolean;
  song?: {
    title: string;
    artist: string;
    genius_id?: string;
    duration?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    start_time?: number;
    artwork_url?: string;
  };
  lyrics?: {
    source: string;
    type: 'synced' | 'unsynced';
    lines: KaraokeLine[];
    total_lines: number;
  };
  song_catalog_id?: string;
  status: string;
  message?: string;
  cache_hit?: boolean;
}

export interface KaraokeLine {
  id: number;
  timestamp: number; // milliseconds
  text: string;
  duration?: number; // milliseconds
  startTime?: number; // seconds
  endTime?: number; // seconds
  recordingStart?: number; // milliseconds
  recordingEnd?: number; // milliseconds
}

export interface KaraokeSession {
  id: string;
  trackId: string;
  userId?: string;
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

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number;
}

export interface LineScore {
  score: number; // 0-100
  feedback: string;
  transcript?: string;
  wordScores?: Array<{
    word: string;
    score: number;
    matched: boolean;
    phoneticMatch: boolean;
  }>;
}

export interface SessionResults {
  success: boolean;
  finalScore: number;
  totalLines: number;
  perfectLines: number;
  goodLines: number;
  needsWorkLines: number;
  accuracy: number;
  sessionId: string;
}

export interface RecordingChunk {
  startIndex: number;
  endIndex: number;
  expectedText: string;
  startTime: number;
  endTime: number;
}

export interface SessionCompletionData {
  score: number;
  accuracy: number;
  totalLines: number;
  perfectLines: number;
  goodLines: number;
  needsWorkLines: number;
  practiceRecommended: boolean;
}