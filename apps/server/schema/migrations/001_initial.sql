-- Scarlett Karaoke Database Schema
-- Migration 001: Initial schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT true,
  
  -- Subscription
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
  subscription_expires_at DATETIME,
  trial_expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
  
  -- Unlock Protocol
  unlock_key_id TEXT,
  unlock_lock_address TEXT,
  unlock_verified_at DATETIME,
  
  -- Credits
  credits_used INTEGER DEFAULT 0,
  credits_limit INTEGER DEFAULT 100,
  credits_reset_at DATETIME DEFAULT (datetime('now', '+1 month'))
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_active ON users(is_active);

-- Song catalog table
CREATE TABLE IF NOT EXISTS song_catalog (
  id TEXT PRIMARY KEY,
  track_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  
  -- Genius metadata
  genius_id TEXT,
  genius_url TEXT,
  genius_confidence REAL DEFAULT 0,
  soundcloud_match BOOLEAN DEFAULT false,
  artwork_url TEXT,
  
  -- Lyrics metadata
  lyrics_source TEXT CHECK (lyrics_source IN ('genius', 'lrclib', 'manual')),
  lyrics_type TEXT CHECK (lyrics_type IN ('synced', 'unsynced', 'none')),
  lyrics_lines_count INTEGER DEFAULT 0,
  
  -- Statistics
  total_attempts INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  unique_users_attempted INTEGER DEFAULT 0,
  
  -- Timestamps
  last_played_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for song catalog
CREATE INDEX idx_songs_track_id ON song_catalog(track_id);
CREATE INDEX idx_songs_genius_id ON song_catalog(genius_id);
CREATE INDEX idx_songs_popularity ON song_catalog(total_attempts DESC, success_rate DESC);
CREATE INDEX idx_songs_recent ON song_catalog(last_played_at DESC);

-- Karaoke sessions table
CREATE TABLE IF NOT EXISTS karaoke_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  track_id TEXT NOT NULL,
  
  -- Song metadata snapshot
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_genius_id TEXT,
  song_duration INTEGER,
  song_difficulty TEXT,
  
  -- Session state
  current_line INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  
  -- Scoring
  total_score INTEGER DEFAULT 0,
  lines_completed INTEGER DEFAULT 0,
  lines_total INTEGER DEFAULT 0,
  accuracy_percentage REAL DEFAULT 0,
  
  -- Timing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  duration_seconds INTEGER,
  
  -- Credits
  credits_used INTEGER DEFAULT 1,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for sessions
CREATE INDEX idx_sessions_user ON karaoke_sessions(user_id);
CREATE INDEX idx_sessions_status ON karaoke_sessions(status);
CREATE INDEX idx_sessions_created ON karaoke_sessions(created_at DESC);

-- Line scores table
CREATE TABLE IF NOT EXISTS line_scores (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  line_text TEXT NOT NULL,
  score INTEGER NOT NULL,
  transcribed_text TEXT,
  attempt_number INTEGER DEFAULT 1,
  processing_time_ms INTEGER,
  feedback_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES karaoke_sessions(id) ON DELETE CASCADE
);

-- Indexes for line scores
CREATE INDEX idx_line_scores_session ON line_scores(session_id);
CREATE INDEX idx_line_scores_composite ON line_scores(session_id, line_index);

-- User best scores table
CREATE TABLE IF NOT EXISTS user_best_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  best_score INTEGER NOT NULL,
  best_session_id TEXT,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_attempts INTEGER DEFAULT 1,
  average_score REAL DEFAULT 0,
  last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (best_session_id) REFERENCES karaoke_sessions(id) ON DELETE SET NULL,
  UNIQUE(user_id, song_id)
);

-- Indexes for best scores
CREATE INDEX idx_best_scores_user ON user_best_scores(user_id);
CREATE INDEX idx_best_scores_song ON user_best_scores(song_id);
CREATE INDEX idx_best_scores_leaderboard ON user_best_scores(song_id, best_score DESC);

-- Song match events table (for analytics)
CREATE TABLE IF NOT EXISTS song_match_events (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  song_catalog_id TEXT,
  search_query TEXT,
  genius_confidence REAL,
  soundcloud_match BOOLEAN DEFAULT false,
  match_method TEXT,
  success BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (song_catalog_id) REFERENCES song_catalog(id) ON DELETE SET NULL
);

-- Indexes for match events
CREATE INDEX idx_match_events_track ON song_match_events(track_id);
CREATE INDEX idx_match_events_created ON song_match_events(created_at DESC);