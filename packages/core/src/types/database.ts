// Database model types

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

export interface LineScoreRecord {
  id: string;
  sessionId: string;
  lineIndex: number;
  lineText: string;
  score: number;
  transcribedText?: string;
  feedback?: string;
  attemptNumber: number;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  trackId: string;
  songCatalogId?: string;
  status: 'active' | 'completed' | 'abandoned';
  totalScore: number;
  linesCompleted: number;
  accuracyPercentage: number;
  createdAt: string;
  completedAt?: string;
}

export interface GeniusSong {
  id: number;
  title: string;
  url: string;
  primary_artist: {
    id: number;
    name: string;
  };
  album?: {
    id: number;
    name: string;
  };
  song_art_image_url?: string;
  media?: Array<{
    provider: string;
    type: string;
    url: string;
  }>;
}