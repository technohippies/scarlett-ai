// Simple, direct karaoke lookup without complex Genius fallbacks

import { LRCLibService } from './services/lrclib';

export async function simpleKaraokeLookup(trackId: string, trackTitle: string) {
  console.log(`[SimpleKaraoke] Looking up: ${trackId} - "${trackTitle}"`);

  // Extract clean artist from trackId
  const artistFromTrack = trackId.split('/')[0] || '';
  const cleanArtist = artistFromTrack.replace(/official|music/gi, '').trim();

  // Try title variants in order of preference
  const titleVariants = [
    trackTitle.replace(/\([^)]*\)/g, '').trim(), // Remove all parentheses
    trackTitle.split('(')[0].trim(), // Split on first parenthesis
    trackTitle, // Original title
  ];

  const lrcLibService = new LRCLibService();

  for (const title of titleVariants) {
    if (!title) continue;

    console.log(`[SimpleKaraoke] Trying: "${cleanArtist}" - "${title}"`);

    const result = await lrcLibService.getBestLyrics({
      track_name: title,
      artist_name: cleanArtist,
    });

    if (result.type !== 'none') {
      console.log(`[SimpleKaraoke] Found lyrics: ${cleanArtist} - ${title}`);
      return {
        found: true,
        artist: cleanArtist,
        title: title,
        lyricsResult: result,
      };
    }
  }

  console.log(`[SimpleKaraoke] No lyrics found for any variant`);
  return {
    found: false,
    artist: cleanArtist,
    title: trackTitle,
    lyricsResult: { type: 'none' },
  };
}
