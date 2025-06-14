-- Create user_streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_completion_date DATE,
    timezone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user_daily_completions table for tracking daily progress
CREATE TABLE IF NOT EXISTS user_daily_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    completion_date DATE NOT NULL,
    songs_completed INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, completion_date)
    -- FOREIGN KEY (user_id) REFERENCES user_streaks(user_id) ON DELETE CASCADE -- Not supported in D1
);

-- Add columns to performances table if they don't exist
-- Note: SQLite/D1 doesn't support ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- These columns should be added in the performances table creation or in a separate migration

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_song_score ON performances(song_catalog_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_best ON performances(user_id, is_best_score);

-- Create view for song leaderboards
-- Note: RANK() OVER is not supported in D1, so we'll use a simpler approach
CREATE VIEW IF NOT EXISTS song_leaderboards AS
SELECT 
    p1.song_catalog_id,
    p1.user_id,
    p1.score,
    p1.created_at,
    (SELECT COUNT(*) + 1 FROM performances p2 
     WHERE p2.song_catalog_id = p1.song_catalog_id 
     AND (p2.score > p1.score OR (p2.score = p1.score AND p2.created_at < p1.created_at))) as position
FROM performances p1
WHERE p1.score > 0;

-- Create view for user rankings
CREATE VIEW IF NOT EXISTS user_rankings AS
SELECT 
    user_id,
    COUNT(DISTINCT song_catalog_id) as songs_played,
    COUNT(CASE WHEN position = 1 THEN 1 END) as first_place_count,
    MAX(score) as best_score
FROM song_leaderboards
GROUP BY user_id;