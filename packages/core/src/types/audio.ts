// Audio processing and transcription types

export interface AudioService {
  findAudioElement(): HTMLAudioElement | null;
  play(): Promise<void>;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
  setCurrentTime(time: number): void;
  onTimeUpdate(callback: (time: number) => void): () => void;
  onEnded(callback: () => void): () => void;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface DeepgramVADConfig {
  apiKey: string;
  utteranceEndMs?: number; // Default 1000ms
  endpointingMs?: number; // Default 300ms
  interimResults?: boolean; // Default true
}

export interface DeepgramResponse {
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
  };
}