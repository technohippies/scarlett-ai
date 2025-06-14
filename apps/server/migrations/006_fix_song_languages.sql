-- Fix incorrectly labeled song languages
-- Beyoncé songs are in English, not Spanish

UPDATE song_catalog 
SET language = 'en'
WHERE artist LIKE '%Beyoncé%' 
  AND title IN ('Halo', 'TYRANT', 'CUFF IT')
  AND (language = 'es' OR language IS NULL);

UPDATE song_catalog 
SET language = 'en'
WHERE artist LIKE '%Beyonce%' 
  AND title IN ('Halo', 'TYRANT', 'CUFF IT')
  AND (language = 'es' OR language IS NULL);

-- Set language for known English songs
UPDATE song_catalog 
SET language = 'en'
WHERE language IS NULL
  AND (
    (artist LIKE '%Kanye%' AND title IN ('Stronger', 'Mercy'))
    OR (artist LIKE '%2Pac%' AND title IN ('Hail Mary', 'California Love', 'Hit ''Em Up', 'How Do U Want It'))
    OR (artist LIKE '%Dua Lipa%' AND title = 'Cool')
  );

-- Set language for known Spanish songs  
UPDATE song_catalog 
SET language = 'es'
WHERE language IS NULL
  AND (
    (artist LIKE '%Shakira%' AND title IN ('No', 'Waka Waka'))
    OR (artist LIKE '%Luis Fonsi%' AND title = 'Despacito')
    OR (artist LIKE '%Bad Bunny%')
  );

-- Log the changes
SELECT 
  artist,
  title,
  language,
  COUNT(*) as count
FROM song_catalog
WHERE language IS NOT NULL
GROUP BY artist, title, language
ORDER BY artist, title;