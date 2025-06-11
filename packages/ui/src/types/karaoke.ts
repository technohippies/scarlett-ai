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
  session_id: string;
  track_id: string;
  song: {
    title: string;
    artist: string;
    genius_id?: string;
  };
  user_id: string;
  started_at: string;
  status: 'active' | 'completed' | 'abandoned';
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
  attempts: number;
  wordTimings?: WordTiming[];
  wordScores?: Array<{
    expected: string;
    transcribed: string;
    score: number;
  }>;
  transcriptionConfidence?: number;
  transcript?: string;
}

export interface ChunkInfo {
  startIndex: number;
  endIndex: number;
  expectedText: string;
  wordCount: number;
}

export interface AudioProcessorOptions {
  sampleRate?: number;
  onLineProcessed?: (lineIndex: number, audioBlob: Blob | null) => void;
}

export interface SessionResults {
  overallScore: number;
  totalLines: number;
  completedLines: number;
  averageScore: number;
  bestLineScore: number;
  worstLineScore: number;
  lineResults: Array<{
    lineIndex: number;
    text: string;
    score: number;
    attempts: number;
  }>;
}