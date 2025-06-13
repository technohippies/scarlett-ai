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
    UNIQUE (user_id, completion_date),
    FOREIGN KEY (user_id) REFERENCES user_streaks(user_id) ON DELETE CASCADE
);

-- Create performances table if it doesn't exist
CREATE TABLE IF NOT EXISTS performances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    song_catalog_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    accuracy REAL,
    session_duration_ms INTEGER,
    lines_completed INTEGER,
    total_lines INTEGER,
    is_best_score BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_song_score ON performances(song_catalog_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_best ON performances(user_id, is_best_score);

-- Create view for song leaderboards
CREATE VIEW IF NOT EXISTS song_leaderboards AS
SELECT 
    song_catalog_id,
    user_id,
    score,
    created_at,
    RANK() OVER (PARTITION BY song_catalog_id ORDER BY score DESC, created_at ASC) as position
FROM performances
WHERE score > 0;