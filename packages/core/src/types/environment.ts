// Environment and configuration types

export interface Env {
  // Bindings
  DB: any; // D1Database from Cloudflare Workers
  
  // Environment variables
  ENVIRONMENT: 'development' | 'production' | 'test';
  
  // Secrets
  JWT_SECRET: string;
  GENIUS_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  VENICE_API_KEY?: string;
}

export interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'no-karaoke';
  error?: string;
}

export interface AppConfig {
  apiUrl: string;
  wsUrl?: string;
  environment: 'development' | 'production' | 'test';
  features: {
    karaoke: boolean;
    practice: boolean;
    social: boolean;
    leaderboard: boolean;
  };
}