import { Hono } from 'hono';
import { z } from 'zod';
import { cors } from 'hono/cors';
import { SongService } from '../services/song.service';
import type { Env } from '../types';

const searchRoutes = new Hono<{ 
  Bindings: Env;
  Variables: {
    songService: SongService;
  };
}>();

// Enable CORS
searchRoutes.use('/*', cors());

// Middleware to inject services
searchRoutes.use('*', async (c, next) => {
  const songService = new SongService(c.env);
  c.set('songService', songService);
  await next();
});

// Search schema
const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20)
});

// Search songs
searchRoutes.get('/', async (c) => {
  console.log('[Search] Request received:', c.req.url);
  
  try {
    // Validate query parameters
    const result = searchQuerySchema.safeParse(c.req.query());
    if (!result.success) {
      console.log('[Search] Validation failed:', result.error);
      return c.json({ 
        error: 'Invalid search query',
        details: result.error.errors 
      }, 400);
    }

    const { q, limit } = result.data;
    console.log('[Search] Query:', q, 'Limit:', limit);
    const songService = c.get('songService');
    
    // First, search our local database
    console.log('[Search] Searching local database...');
    const localResults = await songService.searchSongs(q, limit);
    console.log('[Search] Local results found:', localResults.length);
    
    // If we have enough results locally, return them
    if (localResults.length >= limit / 2) {
      console.log('[Search] Returning local results only');
      const formattedResults = localResults.map(song => ({
        id: song.id,
        trackId: song.trackId,
        title: song.title,
        artist: song.artist,
        hasLyrics: song.lyricsType !== 'none',
        artworkUrl: song.artworkUrl,
        difficulty: song.difficulty,
        totalAttempts: song.totalAttempts,
        source: 'local'
      }));

      return c.json({
        success: true,
        query: q,
        results: formattedResults,
        total: formattedResults.length
      });
    }
    
    // If not enough local results, search soundcloak
    console.log('[Search] Not enough local results, searching soundcloak for:', q);
    
    // Search soundcloak - need to add type=tracks parameter
    const searchUrl = `https://sc.maid.zone/search?q=${encodeURIComponent(q)}&type=tracks`;
    console.log('[Search] Fetching:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    console.log('[Search] Soundcloak response status:', response.status);

    if (!response.ok) {
      console.error('Soundcloak search failed:', response.status);
      // Return whatever local results we have
      const formattedResults = localResults.map(song => ({
        id: song.id,
        trackId: song.trackId,
        title: song.title,
        artist: song.artist,
        hasLyrics: song.lyricsType !== 'none',
        artworkUrl: song.artworkUrl,
        difficulty: song.difficulty,
        totalAttempts: song.totalAttempts,
        source: 'local'
      }));

      return c.json({
        success: true,
        query: q,
        results: formattedResults,
        total: formattedResults.length
      });
    }

    const html = await response.text();
    console.log('[Search] HTML length:', html.length);
    console.log('[Search] HTML preview:', html.substring(0, 500));
    
    // Extract search results from the HTML
    // Pattern: <a class="listing" href="/artist/track-name"><img...><div class="meta"><h3>Title</h3><span>Artist</span></div></a>
    const searchResultPattern = /<a class="listing" href="\/([^"]+)">\s*<img[^>]*src="([^"]*)"[^>]*>\s*<div class="meta">\s*<h3>([^<]+)<\/h3>\s*<span>([^<]+)<\/span>/gs;
    
    const scResults = [];
    let match;
    
    while ((match = searchResultPattern.exec(html)) !== null && scResults.length < limit) {
      const trackId = match[1];
      const imageUrl = match[2];
      const title = match[3].trim();
      const artist = match[4].trim();
      
      console.log('[Search] Found match:', { trackId, title, artist });
      
      // Check if we already have this track in local results
      const existsLocally = localResults.some(song => song.trackId === trackId);
      
      if (!existsLocally) {
        // Add the track from search results
        scResults.push({
          id: `sc-${trackId}`,
          trackId: trackId,
          title: title,
          artist: artist,
          hasLyrics: false, // Will be determined when selected
          artworkUrl: imageUrl,
          source: 'soundcloak'
        });
        
        console.log('[Search] Added soundcloak result:', { trackId, title, artist });
      }
    }
    
    // If no pattern matches, try a simpler approach
    if (scResults.length === 0) {
      console.log('[Search] No results from main pattern, trying simple pattern...');
      const simplePattern = /<a[^>]+href="\/([^"\/]+\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
      
      while ((match = simplePattern.exec(html)) !== null && scResults.length < limit) {
        const href = match[1];
        const text = match[2].trim();
        
        // Filter out non-track links
        if (!href.includes('tags') && !href.includes('discover') && href.includes('/')) {
          const parts = href.split('/');
          if (parts.length === 2) {
            scResults.push({
              id: `sc-${href}`,
              trackId: href,
              title: text,
              artist: parts[0],
              hasLyrics: false,
              source: 'soundcloak'
            });
          }
        }
      }
    }
    
    // Combine and format all results
    const allResults = [
      ...localResults.map(song => ({
        id: song.id,
        trackId: song.trackId,
        title: song.title,
        artist: song.artist,
        hasLyrics: song.lyricsType !== 'none',
        artworkUrl: song.artworkUrl,
        difficulty: song.difficulty,
        totalAttempts: song.totalAttempts,
        source: 'local'
      })),
      ...scResults
    ].slice(0, limit);

    console.log('[Search] Final results:', {
      total: allResults.length,
      local: localResults.length,
      soundcloak: scResults.length
    });
    
    return c.json({
      success: true,
      query: q,
      results: allResults,
      total: allResults.length,
      sources: {
        local: localResults.length,
        soundcloak: scResults.length
      }
    });

  } catch (error) {
    console.error('[Search] Error:', error);
    return c.json({ 
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export { searchRoutes };