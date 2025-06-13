-- Migration 004: Add image metadata columns
-- Adds columns for caching artwork URLs and SoundCloud metadata

-- Add artwork URL variations to song_catalog
ALTER TABLE song_catalog ADD COLUMN artwork_url_small TEXT;
ALTER TABLE song_catalog ADD COLUMN artwork_url_medium TEXT;
ALTER TABLE song_catalog ADD COLUMN artwork_url_large TEXT;

-- Add SoundCloud metadata columns
ALTER TABLE song_catalog ADD COLUMN sc_likes_count INTEGER DEFAULT 0;
ALTER TABLE song_catalog ADD COLUMN sc_plays_count INTEGER DEFAULT 0;
ALTER TABLE song_catalog ADD COLUMN sc_metadata_updated_at DATETIME;

-- Create index for metadata updates
CREATE INDEX idx_song_catalog_metadata_update ON song_catalog(sc_metadata_updated_at);