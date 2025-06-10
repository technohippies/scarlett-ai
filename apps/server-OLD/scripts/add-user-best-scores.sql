-- Add user best scores tracking to existing database
-- Run with: wrangler d1 execute scarlett-dev --file=scripts/add-user-best-scores.sql

-- User Best Scores table - Track each user's best score per song
CREATE TABLE IF NOT EXISTS user_best_scores (
  id TEXT PRIMARY KEY, -- UUID
  
  -- Composite unique key: one best score per user per song
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL, -- Can be genius_id or track_id
  
  -- Score information
  best_score INTEGER NOT NULL, -- 0-100
  best_session_id TEXT NOT NULL, -- Link to the session that achieved this score
  achieved_at DATETIME NOT NULL, -- When they got this score
  
  -- Additional stats
  total_attempts INTEGER DEFAULT 1, -- How many times they've tried this song
  average_score REAL DEFAULT 0.0, -- Their average score across all attempts
  last_played_at DATETIME NOT NULL,
  
  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (best_session_id) REFERENCES karaoke_sessions(session_id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_best_scores_user_id ON user_best_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_best_scores_song_id ON user_best_scores(song_id);
CREATE INDEX IF NOT EXISTS idx_user_best_scores_best_score ON user_best_scores(song_id, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_best_scores_achieved_at ON user_best_scores(achieved_at DESC);

-- Trigger to update timestamps
CREATE TRIGGER IF NOT EXISTS update_user_best_scores_timestamp 
  AFTER UPDATE ON user_best_scores 
  BEGIN 
    UPDATE user_best_scores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- View for leaderboards (top scores per song)
CREATE VIEW IF NOT EXISTS song_leaderboards AS
SELECT 
  ubs.song_id,
  ubs.user_id,
  u.display_name as user_display,
  u.wallet_address,
  ubs.best_score,
  ubs.achieved_at,
  RANK() OVER (PARTITION BY ubs.song_id ORDER BY ubs.best_score DESC, ubs.achieved_at ASC) as rank
FROM user_best_scores ubs
JOIN users u ON ubs.user_id = u.id
WHERE ubs.best_score > 0
ORDER BY ubs.song_id, rank;

-- Function to update user best score after session completion
-- This will be called from the application code after grading