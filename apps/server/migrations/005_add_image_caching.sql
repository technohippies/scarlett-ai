-- Migration 005: Add image caching support (safe version)
-- This migration adds support for caching external images
-- It checks if columns exist before adding them

-- Create image cache table for storing proxied images
CREATE TABLE IF NOT EXISTS image_cache (
  id TEXT PRIMARY KEY,
  original_url TEXT UNIQUE NOT NULL,
  cached_path TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 1
);

-- Indexes for image cache
CREATE INDEX IF NOT EXISTS idx_image_cache_url ON image_cache(original_url);
CREATE INDEX IF NOT EXISTS idx_image_cache_accessed ON image_cache(last_accessed_at);

-- Note: SQLite/D1 doesn't support conditional ALTER TABLE statements
-- The columns for song_catalog should be added in the initial schema or handled separately
-- If you need to add these columns and they don't exist, you'll need to handle it manually