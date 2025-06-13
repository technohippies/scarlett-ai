-- Migration 005: Add image caching support
-- This migration adds support for caching external images

-- Add additional image fields to song_catalog
ALTER TABLE song_catalog ADD COLUMN artwork_url_small TEXT;
ALTER TABLE song_catalog ADD COLUMN artwork_url_medium TEXT;
ALTER TABLE song_catalog ADD COLUMN artwork_url_large TEXT;
ALTER TABLE song_catalog ADD COLUMN artwork_cached_at DATETIME;
ALTER TABLE song_catalog ADD COLUMN artwork_source TEXT;

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
CREATE INDEX idx_image_cache_url ON image_cache(original_url);
CREATE INDEX idx_image_cache_accessed ON image_cache(last_accessed_at);

-- Add soundcloud metadata fields
ALTER TABLE song_catalog ADD COLUMN sc_likes_count INTEGER DEFAULT 0;
ALTER TABLE song_catalog ADD COLUMN sc_plays_count INTEGER DEFAULT 0;
ALTER TABLE song_catalog ADD COLUMN sc_reposts_count INTEGER DEFAULT 0;
ALTER TABLE song_catalog ADD COLUMN sc_created_at DATETIME;
ALTER TABLE song_catalog ADD COLUMN sc_modified_at DATETIME;
ALTER TABLE song_catalog ADD COLUMN sc_genre TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_description TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_user_avatar_url TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_user_name TEXT;