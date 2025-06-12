// API request and response types

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

export interface ApiError extends Error {
  statusCode: number;
  code?: string;
}

// Farcaster API Types
export interface DemoTokenResponse {
  token: string;
}

export interface UserCreditsResponse {
  credits: number;
  fid?: number;
}

export interface PurchaseCreditsRequest {
  fid: number;
  credits: number;
  transactionHash?: string;
  chain: 'Base' | 'Solana';
}

export interface PurchaseCreditsResponse {
  success: boolean;
  newBalance: number;
}

// Karaoke API Types
export interface StartSessionRequest {
  trackId: string;
  songData: {
    title: string;
    artist: string;
    geniusId?: string;
    duration?: number;
    difficulty?: string;
  };
  songCatalogId?: string;
}

export interface GradeLineRequest {
  sessionId: string;
  lineIndex: number;
  audioBuffer: string; // base64
  expectedText: string;
  startTime: number;
  endTime: number;
}

export interface CompleteSessionRequest {
  sessionId: string;
  fullAudioBuffer?: string; // base64
}

// STT API Types
export interface TranscribeRequest {
  audioBase64: string;
  expectedText?: string;
  preferDeepgram?: boolean;
}

export interface TranscribeResponse extends ApiResponse {
  data?: {
    transcript: string;
    confidence: number;
    provider?: string;
  };
}