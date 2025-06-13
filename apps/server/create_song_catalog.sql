-- Create song catalog table
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