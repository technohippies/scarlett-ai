-- Karaoke Database Initialization Script
-- Run this to set up karaoke performance tracking tables

-- === KARAOKE PERFORMANCE TRACKING ===

-- Track each karaoke session
CREATE TABLE IF NOT EXISTS karaoke_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    genius_id TEXT NULL,
    track_id TEXT NULL, -- Store the original track ID from the request
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL,
    total_lines INTEGER DEFAULT 0,
    lines_completed INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned'))
);

-- Track each line attempt within a session
CREATE TABLE IF NOT EXISTS karaoke_line_attempts (
    attempt_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES karaoke_sessions(session_id) ON DELETE CASCADE,
    line_index INTEGER NOT NULL,
    line_timestamp_ms INTEGER NULL, -- e.g., 270 for [00:00.27]
    expected_text TEXT NOT NULL,    -- "Mercy on me, baby"
    transcribed_text TEXT NOT NULL, -- "Testing one, two, three"
    overall_score INTEGER NOT NULL, -- 11 (out of 100)
    attempt_number INTEGER DEFAULT 1,
    attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- STT metadata
    processing_time_ms INTEGER NULL,
    stt_confidence REAL NULL,
    
    -- Scoring breakdown
    word_accuracy REAL NULL,
    sequence_bonus REAL NULL,
    length_penalty REAL NULL,
    attempt_penalty REAL NULL
);

-- Extract individual words from lines for vocabulary analysis
CREATE TABLE IF NOT EXISTS karaoke_word_extractions (
    extraction_id SERIAL PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES karaoke_line_attempts(attempt_id) ON DELETE CASCADE,
    
    -- Word from the expected lyrics
    expected_word TEXT NOT NULL,
    word_position INTEGER NOT NULL,      -- Position in line (0-indexed)
    
    -- Analysis (computed by scoring algorithm)
    was_likely_spoken BOOLEAN NOT NULL,  -- Based on similarity matching
    similarity_score REAL NULL,          -- Word matching score (0.0-1.0)
    phonetic_match BOOLEAN DEFAULT FALSE,
    transcribed_as TEXT NULL,            -- What STT thought this word was
    
    -- Learning flags
    marked_for_practice BOOLEAN DEFAULT FALSE,
    difficulty_assessment TEXT NULL,     -- 'easy'|'medium'|'hard'
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Link extracted words to existing vocabulary system
CREATE TABLE IF NOT EXISTS karaoke_vocabulary_encounters (
    encounter_id SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES karaoke_word_extractions(extraction_id) ON DELETE CASCADE,
    lexeme_id INTEGER NULL, -- REFERENCES lexemes(lexeme_id) - May be NULL if word not in vocab system yet
    
    -- Context for learning
    song_line_context TEXT NOT NULL,     -- Full expected line for context
    song_context TEXT NULL,              -- "{artist} - {track}" for reference
    first_encountered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_encounters INTEGER DEFAULT 1,
    successful_encounters INTEGER DEFAULT 0, -- When similarity_score > threshold
    last_encounter_score REAL NULL,     -- Most recent similarity score
    
    UNIQUE(extraction_id, lexeme_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_karaoke_sessions_user_id ON karaoke_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_karaoke_sessions_started_at ON karaoke_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_karaoke_line_attempts_session_id ON karaoke_line_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_karaoke_line_attempts_attempted_at ON karaoke_line_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_karaoke_word_extractions_attempt_id ON karaoke_word_extractions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_karaoke_word_extractions_marked_for_practice ON karaoke_word_extractions(marked_for_practice) WHERE marked_for_practice = true;
CREATE INDEX IF NOT EXISTS idx_karaoke_vocabulary_encounters_lexeme_id ON karaoke_vocabulary_encounters(lexeme_id);

-- Test data insertion (optional - for development testing)
-- Uncomment if you want to insert some test data

-- INSERT INTO karaoke_sessions (session_id, user_id, track_name, artist_name, status) 
-- VALUES ('test-session-123', 'test-user-id', 'Mercy', 'Duffy', 'active');

-- Test queries to verify setup
-- SELECT 'karaoke_sessions' as table_name, COUNT(*) as count FROM karaoke_sessions
-- UNION ALL
-- SELECT 'karaoke_line_attempts' as table_name, COUNT(*) as count FROM karaoke_line_attempts
-- UNION ALL  
-- SELECT 'karaoke_word_extractions' as table_name, COUNT(*) as count FROM karaoke_word_extractions;

-- === END KARAOKE PERFORMANCE TRACKING === 