-- Scarlett Karaoke Database Schema
-- Cloudflare D1 SQLite Database

-- Users table - Core user accounts
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- UUID
  email TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE, -- Ethereum wallet for Unlock Protocol
  display_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT true,
  
  -- Subscription info
  subscription_status TEXT DEFAULT 'trial', -- 'trial', 'active', 'expired', 'cancelled'
  subscription_expires_at DATETIME,
  trial_expires_at DATETIME DEFAULT (datetime('now', '+7 days')), -- 7-day trial
  
  -- Unlock Protocol integration
  unlock_key_id TEXT, -- NFT key ID from Unlock Protocol
  unlock_lock_address TEXT, -- Lock contract address
  unlock_verified_at DATETIME,
  
  -- Usage limits
  credits_used INTEGER DEFAULT 0,
  credits_limit INTEGER DEFAULT 100, -- Credits per billing period
  credits_reset_at DATETIME DEFAULT (datetime('now', '+1 month'))
);

-- JWT Sessions table - Track active JWT tokens
CREATE TABLE jwt_sessions (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL, -- Hashed JWT for revocation
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  is_revoked BOOLEAN DEFAULT false,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Progress table - Track karaoke performance over time
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  total_songs_attempted INTEGER DEFAULT 0,
  total_songs_completed INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  average_score REAL DEFAULT 0.0,
  highest_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_time_practiced INTEGER DEFAULT 0, -- seconds
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Karaoke Sessions table - Enhanced with user tracking
CREATE TABLE karaoke_sessions (
  id TEXT PRIMARY KEY, -- UUID (session_id)
  user_id TEXT, -- NULL for anonymous sessions
  track_id TEXT NOT NULL,
  
  -- Song metadata
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_genius_id TEXT,
  song_duration INTEGER, -- milliseconds
  song_difficulty TEXT, -- 'beginner', 'intermediate', 'advanced'
  
  -- Session state
  current_line INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'abandoned'
  
  -- Scoring
  total_score INTEGER DEFAULT 0,
  lines_completed INTEGER DEFAULT 0,
  lines_total INTEGER DEFAULT 0,
  accuracy_percentage REAL DEFAULT 0.0,
  
  -- Timing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  duration_seconds INTEGER, -- actual practice time
  
  -- Credit tracking
  credits_used INTEGER DEFAULT 1, -- Each session costs credits
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Line Scores table - Individual line performance within sessions
CREATE TABLE line_scores (
  id TEXT PRIMARY KEY, -- UUID
  session_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  line_text TEXT NOT NULL,
  
  -- Performance metrics
  score INTEGER NOT NULL, -- 0-100
  accuracy REAL, -- 0.0-1.0
  pronunciation_score INTEGER, -- 0-100
  timing_score INTEGER, -- 0-100
  
  -- Attempts
  attempt_number INTEGER DEFAULT 1,
  attempts_total INTEGER DEFAULT 1,
  
  -- Feedback
  feedback_text TEXT,
  transcribed_text TEXT, -- What was actually said
  character_response TEXT, -- AI character feedback
  
  -- Processing info
  processing_time_ms INTEGER,
  audio_duration_ms INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, line_index, attempt_number)
);

-- User Achievements table - Gamification
CREATE TABLE user_achievements (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  achievement_type TEXT NOT NULL, -- 'first_song', 'perfect_score', 'streak_5', etc.
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  experience_points INTEGER DEFAULT 0,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, achievement_type)
);

-- Payment Records table - Track Unlock Protocol purchases
CREATE TABLE payment_records (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  
  -- Unlock Protocol details
  transaction_hash TEXT NOT NULL,
  lock_address TEXT NOT NULL,
  key_id TEXT NOT NULL,
  
  -- Payment info
  amount_wei TEXT NOT NULL, -- Store as string to avoid precision issues
  token_symbol TEXT, -- ETH, USDC, etc.
  network_id INTEGER, -- Chain ID
  
  -- Subscription details
  subscription_duration_days INTEGER,
  credits_granted INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed', 'refunded'
  confirmed_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_jwt_sessions_user_id ON jwt_sessions(user_id);
CREATE INDEX idx_jwt_sessions_token_hash ON jwt_sessions(token_hash);
CREATE INDEX idx_karaoke_sessions_user_id ON karaoke_sessions(user_id);
CREATE INDEX idx_karaoke_sessions_track_id ON karaoke_sessions(track_id);
CREATE INDEX idx_line_scores_session_id ON line_scores(session_id);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX idx_payment_records_transaction_hash ON payment_records(transaction_hash);

-- Triggers to update timestamps
CREATE TRIGGER update_users_timestamp 
  AFTER UPDATE ON users 
  BEGIN 
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER update_user_progress_timestamp 
  AFTER UPDATE ON user_progress 
  BEGIN 
    UPDATE user_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END; 