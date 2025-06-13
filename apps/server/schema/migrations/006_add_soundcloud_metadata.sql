-- Migration: Add SoundCloud metadata columns
-- This adds columns to store metadata extracted from SoundCloud pages

-- Add SoundCloud metadata columns to song_catalog
ALTER TABLE song_catalog ADD COLUMN sc_likes_count INTEGER;
ALTER TABLE song_catalog ADD COLUMN sc_plays_count INTEGER;
ALTER TABLE song_catalog ADD COLUMN sc_reposts_count INTEGER;
ALTER TABLE song_catalog ADD COLUMN sc_genre TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_created_at TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_modified_at TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_user_avatar_url TEXT;
ALTER TABLE song_catalog ADD COLUMN sc_user_name TEXT;

-- Create indexes for commonly queried fields
CREATE INDEX idx_song_catalog_sc_genre ON song_catalog(sc_genre);
CREATE INDEX idx_song_catalog_sc_plays ON song_catalog(sc_plays_count);
CREATE INDEX idx_song_catalog_sc_likes ON song_catalog(sc_likes_count);