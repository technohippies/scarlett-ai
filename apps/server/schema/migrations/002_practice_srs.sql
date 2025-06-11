-- Migration 002: Practice cards and SRS system
-- Adds support for spaced repetition practice of problem words/phrases

-- LLM normalization cache (shared across all users)
CREATE TABLE IF NOT EXISTS phrase_normalizations (
  id TEXT PRIMARY KEY,
  original_text TEXT UNIQUE NOT NULL,
  normalized_text TEXT NOT NULL,
  
  -- LLM analysis
  has_slang BOOLEAN DEFAULT false,
  slang_terms TEXT, -- JSON: {"doesn't": "does not", "gonna": "going to"}
  dialect_info TEXT, -- "AAVE", "Southern US", etc.
  pronunciation_notes TEXT, -- JSON: {"stronger": "be careful with the 'ng' sound"}
  
  -- Metadata
  llm_model TEXT DEFAULT 'venice-v1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_normalizations_original ON phrase_normalizations(original_text);

-- Track individual words/phrases with SRS
CREATE TABLE IF NOT EXISTS practice_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- The specific word/phrase
  target_text TEXT NOT NULL, -- "stronger" or "makes us"
  normalized_text TEXT, -- "stronger" (same if no slang)
  
  -- FSRS fields
  due DATETIME NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'New',
  last_review DATETIME,
  
  -- Performance
  best_score INTEGER DEFAULT 0,
  average_score REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  contexts_seen INTEGER DEFAULT 1, -- How many different lines/songs
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, target_text)
);

CREATE INDEX idx_practice_cards_user_due ON practice_cards(user_id, due);
CREATE INDEX idx_practice_cards_state ON practice_cards(user_id, state);

-- Link cards to their contexts (where they appeared)
CREATE TABLE IF NOT EXISTS card_contexts (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  
  -- Where this word/phrase appeared
  session_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  full_line TEXT NOT NULL, -- "What doesn't kill you makes you stronger"
  position_in_line INTEGER, -- Word position: 0-based index
  
  -- Performance in this context
  original_score INTEGER NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (card_id) REFERENCES practice_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES song_catalog(id) ON DELETE CASCADE
);

CREATE INDEX idx_card_contexts_card ON card_contexts(card_id);
CREATE INDEX idx_card_contexts_session ON card_contexts(session_id);

-- ReadAloud exercises (composed from cards)
CREATE TABLE IF NOT EXISTS readaloud_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Exercise content
  full_line TEXT NOT NULL, -- "What doesn't kill you makes you stronger"
  normalized_line TEXT, -- LLM normalized version
  
  -- Which words we're tracking
  target_card_ids TEXT, -- JSON: ["card1", "card2"] for "doesn't" and "stronger"
  focus_words TEXT, -- JSON: ["doesn't", "stronger"] - what to pay attention to
  
  -- Context
  song_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  
  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES song_catalog(id) ON DELETE CASCADE
);

CREATE INDEX idx_readaloud_user ON readaloud_exercises(user_id, completed);

-- Simple review logs
CREATE TABLE IF NOT EXISTS card_reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Denormalized for easier queries
  
  -- Review data
  score INTEGER NOT NULL,
  transcription TEXT,
  rating TEXT NOT NULL, -- FSRS rating: 'Again', 'Hard', 'Good', 'Easy'
  
  -- FSRS state before review (for analysis)
  stability_before REAL,
  difficulty_before REAL,
  
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (card_id) REFERENCES practice_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_card_reviews_user ON card_reviews(user_id, reviewed_at DESC);
CREATE INDEX idx_card_reviews_card ON card_reviews(card_id, reviewed_at DESC);

-- Track pronunciation patterns for users
CREATE TABLE IF NOT EXISTS pronunciation_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Pattern details
  problem_type TEXT NOT NULL, -- 'substitution', 'omission', 'addition'
  expected_word TEXT NOT NULL,
  common_mistakes TEXT, -- JSON: ["stronga", "strongah"]
  
  -- Where we've seen this
  source_sessions TEXT, -- JSON: ["session_id_1", "session_id_2"]
  source_songs TEXT, -- JSON: ["song_id_1", "song_id_2"]
  
  -- Tracking
  occurrence_count INTEGER DEFAULT 1,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  improving BOOLEAN DEFAULT false,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, expected_word)
);

CREATE INDEX idx_pronunciation_patterns_user ON pronunciation_patterns(user_id);