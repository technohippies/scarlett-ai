-- Add language support to song catalog
ALTER TABLE song_catalog ADD COLUMN language TEXT DEFAULT NULL;

-- Create index for language-based queries
CREATE INDEX idx_songs_language ON song_catalog(language);

-- Update existing songs to have a default language (can be updated later via script)
-- For now, we'll leave them as NULL and update them when we have language data