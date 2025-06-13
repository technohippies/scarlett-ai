#!/usr/bin/env bun

import { ImageService } from '../src/services/image.service';

// Read environment variables
const DB_PATH = process.env.DB_PATH || '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6d684c909cac45628816192c48e3b24c55f57039bda12d782800281e4945d845.sqlite';

async function populateArtwork() {
  const { Database } = await import('bun:sqlite');
  const db = new Database(DB_PATH);
  
  console.log('Fetching songs without artwork...');
  
  // Get all songs without artwork
  const songsWithoutArtwork = db.prepare(`
    SELECT id, track_id, title, artist 
    FROM song_catalog 
    WHERE artwork_url IS NULL OR artwork_url = ''
    ORDER BY total_attempts DESC
    LIMIT 50
  `).all();
  
  console.log(`Found ${songsWithoutArtwork.length} songs without artwork`);
  
  const imageService = new ImageService(db as any);
  let updated = 0;
  
  for (const song of songsWithoutArtwork) {
    console.log(`\nProcessing: ${song.artist} - ${song.title}`);
    
    try {
      // Fetch the soundcloak page
      const soundcloakUrl = `https://sc.maid.zone/${song.track_id}`;
      const response = await fetch(soundcloakUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });
      
      if (!response.ok) {
        console.log(`  Failed to fetch soundcloak page: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      
      // Extract images
      const artworkData = imageService.extractSoundcloudImages(html);
      
      if (artworkData) {
        console.log(`  Found artwork: ${artworkData.url}`);
        
        // Update the database
        const updateStmt = db.prepare(`
          UPDATE song_catalog 
          SET artwork_url = ?,
              artwork_url_small = ?,
              artwork_url_medium = ?,
              artwork_url_large = ?,
              artwork_cached_at = CURRENT_TIMESTAMP,
              artwork_source = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          artworkData.url,
          artworkData.small,
          artworkData.medium,
          artworkData.large,
          artworkData.source,
          song.id
        );
        
        updated++;
        console.log(`  ✓ Updated artwork for ${song.title}`);
      } else {
        console.log(`  No artwork found in HTML`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  Error processing ${song.title}:`, error);
    }
  }
  
  console.log(`\nCompleted! Updated artwork for ${updated} songs`);
  
  // Show some stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN artwork_url IS NOT NULL AND artwork_url != '' THEN 1 END) as with_artwork
    FROM song_catalog
  `).get();
  
  console.log(`\nDatabase stats:`);
  console.log(`Total songs: ${stats.total}`);
  console.log(`Songs with artwork: ${stats.with_artwork} (${Math.round(stats.with_artwork / stats.total * 100)}%)`);
  
  db.close();
}

// Run the script
populateArtwork().catch(console.error);