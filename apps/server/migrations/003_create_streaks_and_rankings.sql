-- Create user_streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id VARCHAR(255) PRIMARY KEY,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_completion_date DATE,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create user_daily_completions table for tracking daily progress
CREATE TABLE IF NOT EXISTS user_daily_completions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    completion_date DATE NOT NULL,
    songs_completed INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_date (user_id, completion_date),
    FOREIGN KEY (user_id) REFERENCES user_streaks(user_id) ON DELETE CASCADE
);

-- Update performances table to include ranking data
ALTER TABLE performances 
ADD COLUMN IF NOT EXISTS is_best_score BOOLEAN DEFAULT FALSE,
ADD INDEX idx_song_score (song_catalog_id, score DESC),
ADD INDEX idx_user_best (user_id, is_best_score);

-- Create view for song leaderboards
CREATE OR REPLACE VIEW song_leaderboards AS
SELECT 
    song_catalog_id,
    user_id,
    score,
    created_at,
    RANK() OVER (PARTITION BY song_catalog_id ORDER BY score DESC, created_at ASC) as position
FROM performances
WHERE score > 0;

-- Create view for user rankings
CREATE OR REPLACE VIEW user_rankings AS
SELECT 
    user_id,
    COUNT(DISTINCT song_catalog_id) as songs_played,
    COUNT(CASE WHEN position = 1 THEN 1 END) as first_place_count,
    MAX(score) as best_score
FROM song_leaderboards
GROUP BY user_id;