-- Fix Karaoke Schema - Correct Foreign Key References
-- This file fixes the foreign key constraint issues

-- Recreate karaoke_line_attempts with correct foreign key reference
CREATE TABLE karaoke_line_attempts (
    attempt_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
    line_index INTEGER NOT NULL,
    line_timestamp_ms INTEGER NULL,
    expected_text TEXT NOT NULL,
    transcribed_text TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER NULL,
    stt_confidence REAL NULL,
    word_accuracy REAL NULL,
    sequence_bonus REAL NULL,
    length_penalty REAL NULL,
    attempt_penalty REAL NULL
);

-- Create karaoke_word_extractions table
CREATE TABLE karaoke_word_extractions (
    extraction_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES karaoke_line_attempts(attempt_id) ON DELETE CASCADE,
    word_text TEXT NOT NULL,
    word_position INTEGER NOT NULL,
    expected_word TEXT NOT NULL,
    word_score REAL NOT NULL,
    extracted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    phonetic_distance REAL NULL,
    edit_distance INTEGER NULL
);

-- Create a simplified vocabulary encounters table without external lexeme dependency
-- This removes the reference to the missing lexemes table
CREATE TABLE karaoke_vocabulary_encounters (
    encounter_id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES karaoke_word_extractions(extraction_id) ON DELETE CASCADE,
    word_text TEXT NOT NULL,
    song_line_context TEXT NOT NULL,
    song_context TEXT NULL,
    first_encountered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_encounters INTEGER DEFAULT 1,
    successful_encounters INTEGER DEFAULT 0,
    last_encounter_score REAL NULL,
    UNIQUE(extraction_id, word_text)
); 