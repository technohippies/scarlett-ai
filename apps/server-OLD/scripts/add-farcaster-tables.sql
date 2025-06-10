-- User metadata table for storing Farcaster-specific data
CREATE TABLE IF NOT EXISTS user_metadata (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Farcaster leaderboard
CREATE TABLE IF NOT EXISTS farcaster_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  fid INTEGER,
  username TEXT,
  track_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_farcaster_leaderboard_track_score 
ON farcaster_leaderboard(track_name, score DESC);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_metadata_key_value 
ON user_metadata(key, value);