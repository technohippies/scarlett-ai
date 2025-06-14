#!/usr/bin/env bun

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Language detection patterns
const detectLanguage = (text: string): string | null => {
  if (!text) return null;
  
  // Remove common filler words that appear in multiple languages
  const cleanText = text.replace(/\b(oh|yeah|ah|la|na|hey|baby)\b/gi, '').trim();
  
  // Spanish patterns
  const spanishPatterns = [
    /\b(despacito|corazón|amor|vida|quiero|tengo|estoy|estar|hacer|puede|siempre|nunca|ahora|después|también|mucho|poco|bueno|malo|grande|pequeño|nuevo|viejo|joven|feliz|triste|bonito|feo|caliente|frío|cerca|lejos|dentro|fuera|arriba|abajo|delante|detrás|izquierda|derecha)\b/i,
    /[áéíóúñ¿¡]/,
    /\b(el|la|los|las|un|una|unos|unas|de|del|al|por|para|con|sin|sobre|bajo|ante|tras|entre|desde|hasta|según|durante|mediante)\b/i,
    /\b(yo|tú|él|ella|nosotros|vosotros|ellos|ellas|me|te|le|nos|os|les|mi|tu|su|nuestro|vuestro)\b/i
  ];
  
  // English patterns
  const englishPatterns = [
    /\b(the|be|to|of|and|that|have|with|you|for|not|but|what|this|from|they|will|would|there|their|been|more|when|other|which|them|than|many|some|time|very|about|just|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|work|first|well|way|even|new|want|because|any|these|give|day|most|us)\b/i,
    /\b(I|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their|mine|yours|hers|ours|theirs)\b/i,
    /\b(am|is|are|was|were|been|being|have|has|had|having|do|does|did|doing|will|would|shall|should|may|might|must|can|could)\b/i
  ];
  
  // Chinese patterns
  const chinesePatterns = [
    /[\u4e00-\u9fa5]/,
    /[\u3400-\u4dbf]/ // Extended Chinese
  ];
  
  // Count matches for each language
  let spanishCount = 0;
  let englishCount = 0;
  let chineseCount = 0;
  
  // Check Spanish
  spanishPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) spanishCount += matches.length;
  });
  
  // Check English
  englishPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) englishCount += matches.length;
  });
  
  // Check Chinese
  chinesePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) chineseCount += matches.length;
  });
  
  console.log(`Language detection for "${text.substring(0, 50)}...": ES=${spanishCount}, EN=${englishCount}, ZH=${chineseCount}`);
  
  // Determine language based on highest count
  if (chineseCount > 0) return 'zh';
  if (spanishCount > englishCount * 1.5) return 'es'; // Require 1.5x more Spanish than English
  if (englishCount > 0) return 'en';
  
  return null;
};

async function main() {
  const dbPath = path.join(__dirname, '../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const dbFile = path.join(dbPath, 'bb207ccc43e93fa21ec614c688faef9012b90bc72f62bf858c4c65a8c2bbf31f.sqlite');
  
  console.log('Opening database:', dbFile);
  const db = new Database(dbFile);
  
  try {
    // Get all songs
    const songs = db.prepare(`
      SELECT id, title, artist, language
      FROM song_catalog
      WHERE 1=1
      ORDER BY title
    `).all();
    
    console.log(`Found ${songs.length} songs`);
    
    // Check each song's lyrics to detect language
    const updates = [];
    
    for (const song of songs) {
      // Skip if we're not sure about detection
      const titleLang = detectLanguage(song.title);
      
      if (titleLang && titleLang !== song.language) {
        updates.push({
          id: song.id,
          title: song.title,
          artist: song.artist,
          currentLang: song.language,
          detectedLang: titleLang
        });
      }
    }
    
    console.log('\nSongs with incorrect language:');
    console.table(updates);
    
    // Ask for confirmation
    if (updates.length > 0) {
      console.log(`\nReady to update ${updates.length} songs. Continue? (y/n)`);
      
      // For now, just show what would be updated
      // In production, you'd prompt for confirmation and update
      
      updates.forEach(update => {
        console.log(`Would update "${update.title}" by ${update.artist}: ${update.currentLang || 'null'} -> ${update.detectedLang}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

main();