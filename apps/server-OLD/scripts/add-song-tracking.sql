-- Add song tracking tables to existing database
-- Run with: wrangler d1 execute scarlett-dev --file=scripts/add-song-tracking.sql

-- Song Catalog table - Master list of all successfully matched songs
CREATE TABLE IF NOT EXISTS song_catalog (
  id TEXT PRIMARY KEY, -- UUID
  
  -- Track identifiers
  track_id TEXT UNIQUE NOT NULL, -- e.g., "eminemofficial/superman-album-version"
  
  -- Song metadata (normalized from first successful match)
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER,
  difficulty TEXT, -- 'beginner', 'intermediate', 'advanced'
  
  -- Source information
  genius_id TEXT,
  genius_url TEXT,
  genius_confidence REAL,
  soundcloud_url TEXT,
  soundcloud_match BOOLEAN DEFAULT false,
  artwork_url TEXT,
  
  -- Lyrics metadata
  lyrics_source TEXT, -- 'lrclib', 'genius', 'manual'
  lyrics_type TEXT, -- 'synced', 'unsynced'
  lyrics_lines_count INTEGER,
  
  -- Match statistics
  total_attempts INTEGER DEFAULT 1, -- How many times users tried this song
  total_completions INTEGER DEFAULT 0, -- How many times completed
  success_rate REAL DEFAULT 0.0, -- completion rate
  average_score REAL DEFAULT 0.0, -- average user score
  
  -- Popularity metrics
  unique_users_attempted INTEGER DEFAULT 0, -- How many different users tried it
  unique_users_completed INTEGER DEFAULT 0, -- How many different users completed it
  last_played_at DATETIME,
  
  -- Admin flags
  is_verified BOOLEAN DEFAULT false, -- Manually verified match
  is_featured BOOLEAN DEFAULT false, -- Promoted song
  is_hidden BOOLEAN DEFAULT false, -- Hidden from discovery
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Song Match Events table - Log each successful match attempt
CREATE TABLE IF NOT EXISTS song_match_events (
  id TEXT PRIMARY KEY, -- UUID
  
  -- Match details
  track_id TEXT NOT NULL,
  song_catalog_id TEXT, -- NULL if first time seeing this song
  
  -- Search metadata
  search_query TEXT NOT NULL, -- What was searched
  genius_confidence REAL,
  soundcloud_match BOOLEAN DEFAULT false,
  match_method TEXT, -- 'genius_soundcloud', 'genius_similarity', 'lrclib_direct'
  
  -- Response metadata
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT, -- If failed
  
  -- Context
  user_id TEXT, -- NULL for anonymous
  session_id TEXT, -- Link to karaoke session if started
  ip_address TEXT,
  user_agent TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (song_catalog_id) REFERENCES song_catalog(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES karaoke_sessions(id) ON DELETE SET NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_song_catalog_track_id ON song_catalog(track_id);
CREATE INDEX IF NOT EXISTS idx_song_catalog_artist ON song_catalog(artist);
CREATE INDEX IF NOT EXISTS idx_song_catalog_popularity ON song_catalog(total_attempts DESC, unique_users_attempted DESC);
CREATE INDEX IF NOT EXISTS idx_song_catalog_success_rate ON song_catalog(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_song_match_events_track_id ON song_match_events(track_id);
CREATE INDEX IF NOT EXISTS idx_song_match_events_created_at ON song_match_events(created_at);
CREATE INDEX IF NOT EXISTS idx_song_match_events_success ON song_match_events(success);
CREATE INDEX IF NOT EXISTS idx_song_match_events_user_id ON song_match_events(user_id);

-- Trigger to update song catalog stats when karaoke session changes
CREATE TRIGGER IF NOT EXISTS update_song_stats_on_session_complete
  AFTER UPDATE ON karaoke_sessions
  WHEN NEW.status = 'completed' AND OLD.status != 'completed'
  BEGIN
    UPDATE song_catalog 
    SET 
      total_completions = total_completions + 1,
      success_rate = CAST(total_completions AS REAL) / total_attempts,
      last_played_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE track_id = NEW.track_id;
    
    -- Update unique users completed count
    UPDATE song_catalog 
    SET unique_users_completed = (
      SELECT COUNT(DISTINCT user_id) 
      FROM karaoke_sessions 
      WHERE track_id = NEW.track_id 
        AND status = 'completed' 
        AND user_id IS NOT NULL
    )
    WHERE track_id = NEW.track_id;
  END;

-- Trigger to update timestamps
CREATE TRIGGER IF NOT EXISTS update_song_catalog_timestamp 
  AFTER UPDATE ON song_catalog 
  BEGIN 
    UPDATE song_catalog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;