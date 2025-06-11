/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import type { Env } from '../types';
import { GeniusService } from '../services/genius.service';
import { LyricsService } from '../services/lyrics.service';

const app = new Hono<{ 
  Bindings: Env;
}>();

// Simple LRCLibService wrapper to match the working implementation
class LRCLibService {
  // In-memory cache for development/single instance
  // For production, use Cloudflare KV or Cache API
  private static successCache = new Map<string, { artist: string; title: string; album?: string }>();
  private static CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  async getBestLyrics(params: {
    track_name: string;
    artist_name: string;
    album_name?: string;
  }) {
    const lyricsService = new LyricsService();
    return await lyricsService.searchLyrics(params);
  }

  // Cache successful search parameters
  static async cacheSuccess(trackId: string, params: { artist: string; title: string; album?: string }, _env?: Env) {
    // In-memory cache (single worker instance only)
    this.successCache.set(trackId, { ...params, timestamp: Date.now() });
    console.log(`[Karaoke] Cached successful search params for: ${trackId}`);
    
    // TODO: For production, also save to Cloudflare KV:
    // if (env?.KARAOKE_CACHE) {
    //   await env.KARAOKE_CACHE.put(
    //     `karaoke:${trackId}`,
    //     JSON.stringify({ ...params, timestamp: Date.now() }),
    //     { expirationTtl: 1800 } // 30 minutes
    //   );
    // }
  }

  // Get cached successful search parameters
  static async getCachedSuccess(trackId: string, _env?: Env): Promise<{ artist: string; title: string; album?: string } | null> {
    // Try in-memory cache first (fast but single-instance only)
    const cached = this.successCache.get(trackId);
    if (cached && Date.now() - (cached as any).timestamp < this.CACHE_DURATION) {
      console.log(`[Karaoke] Using cached search params from memory for: ${trackId}`);
      return cached;
    }
    
    // TODO: For production, check Cloudflare KV:
    // if (env?.KARAOKE_CACHE) {
    //   const kvCached = await env.KARAOKE_CACHE.get(`karaoke:${trackId}`);
    //   if (kvCached) {
    //     const parsed = JSON.parse(kvCached);
    //     console.log(`[Karaoke] Using cached search params from KV for: ${trackId}`);
    //     return parsed;
    //   }
    // }
    
    return null;
  }
}

// Helper functions from working implementation
function cleanLyricsText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content
    .replace(/\[[^\]]*\]/g, '') // Remove bracketed content
    .trim();
}

function processSyncedLyrics(rawLyrics: any[]): any[] {
  const lyricsService = new LyricsService();
  return lyricsService.processSyncedLyrics(rawLyrics);
}

// OPTIONS handled by global CORS middleware

// Core karaoke endpoint - check if track has karaoke data
app.get('/*', async (c) => {
  // Extract track ID from the full path, removing the '/api/karaoke/' prefix
  const fullPath = c.req.url.split('/api/karaoke/')[1];
  const [trackId] = fullPath.split('?'); // Remove query parameters
  const trackTitle = c.req.query('title') || '';
  const artistName = c.req.query('artist') || '';

  try {
    console.log(
      `[Karaoke] Processing track: ${trackId}, title: "${trackTitle}", artist: "${artistName}"`
    );

    // Check if we have cached successful search parameters
    const cachedParams = LRCLibService.getCachedSuccess(trackId);
    if (cachedParams) {
      // Skip directly to the successful search
      const lrcLibService = new LRCLibService();
      const lyricsResult = await lrcLibService.getBestLyrics({
        track_name: cachedParams.title,
        artist_name: cachedParams.artist,
        album_name: cachedParams.album,
      });

      if (lyricsResult.type !== 'none') {
        // Fast path - skip all the other steps including Genius API
        console.log(`[Karaoke] Found lyrics using cached params in fast path`);

        // Process and return lyrics (jump to formatting section)
        const rawLyrics = lyricsResult.lyrics || [];
        let formattedLyrics: any[] = [];

        if (lyricsResult.type === 'synced' && rawLyrics.length > 0) {
          formattedLyrics = processSyncedLyrics(rawLyrics).map((line, index) => ({
            id: index,
            timestamp: line.timestamp,
            text: cleanLyricsText(line.text),
            duration: line.duration,
            startTime: line.timestamp / 1000,
            endTime: (line.timestamp + (line.duration || 0)) / 1000,
            recordingStart: line.recordingStart,
            recordingEnd: line.recordingEnd,
          }));

          const hasValidTimestamps = formattedLyrics.some((line) => line.timestamp > 0);
          if (!hasValidTimestamps) {
            console.log('[Karaoke] WARNING: Cached result has invalid timestamps');
            // Fall through to normal flow
          } else {
            // Return successful cached result
            return c.json({
              track_id: trackId,
              has_karaoke: true,
              song: {
                title: cachedParams.title,
                artist: cachedParams.artist,
                duration: lyricsResult.metadata?.duration ? lyricsResult.metadata.duration * 1000 : null,
                difficulty: formattedLyrics.length > 50 ? 'advanced' : formattedLyrics.length > 25 ? 'intermediate' : 'beginner',
                start_time: 0,
              },
              lyrics: {
                source: 'lrclib',
                type: lyricsResult.type,
                lines: formattedLyrics,
                total_lines: formattedLyrics.length,
              },
              cache_hit: true,
              genius_confidence: 1.0,
              message: `Karaoke ready (cached): ${cachedParams.artist} - ${cachedParams.title}`,
              status: 'success',
            });
          }
        }
      }
    }

    // Use artist from query param if provided, otherwise fall back to extracting from trackId
    let foundArtist = artistName;
    if (!foundArtist) {
      // Extract artist information from trackId (e.g., "beyonce/beyonce-amen" -> "beyonce")
      const trackParts = trackId.split('/');
      foundArtist = trackParts[0] || '';
    }

    // Create a more complete search query by combining artist and title
    let searchQuery = trackTitle;
    if (
      foundArtist &&
      !trackTitle.toLowerCase().includes(foundArtist.toLowerCase())
    ) {
      // Add artist to search query if not already present
      searchQuery = `${foundArtist} ${trackTitle}`;
    }

    console.log(`[Karaoke] Searching for: "${foundArtist}" - "${trackTitle}"`);

    // Step 1: Try Genius first to check for SoundCloud URL match (high confidence)
    const geniusService = new GeniusService(c.env.GENIUS_API_KEY || '');
    const lrcLibService = new LRCLibService();

    let geniusMatch;
    try {
      geniusMatch = await geniusService.findSongMatch(searchQuery, trackId);
    } catch (error) {
      console.log('[Karaoke] Genius API error (continuing with LRCLib only):', error instanceof Error ? error.message : 'Unknown error');
      console.log('[Karaoke] This is OK - the system will still search for lyrics using LRCLib');
      geniusMatch = { found: false, song: null, confidence: 0 };
    }

    let lyricsResult: any = { type: 'none' };
    let foundTitle = '';
    // foundArtist is already set above from query param or trackId
    foundArtist = foundArtist.replace(/official|music/gi, '').trim();
    let song: any = null;

    if (geniusMatch.found && geniusMatch.song && geniusMatch.confidence > 0.9) {
      // High confidence Genius match (likely SoundCloud URL match)
      console.log(
        `[Karaoke] High confidence Genius match: ${geniusMatch.song.primary_artist.name} - ${geniusMatch.song.title}`
      );
      song = geniusMatch.song;

      // Get full song details for media links
      const fullSong = await geniusService.getSongById(song.id);
      if (fullSong) {
        song = fullSong;
      }

      // Try to get lyrics from LRCLib using Genius-validated info
      // Include album if available for better matching
      const lrcQuery: any = {
        track_name: song.title,
        artist_name: song.primary_artist.name,
      };

      if (song.album?.name) {
        lrcQuery.album_name = song.album.name;
        console.log(
          `[Karaoke] Including album in search: "${song.album.name}"`
        );
      }

      lyricsResult = await lrcLibService.getBestLyrics(lrcQuery);
      
      // Cache successful parameters if found
      if (lyricsResult.type !== 'none') {
        LRCLibService.cacheSuccess(trackId, {
          artist: song.primary_artist.name,
          title: song.title,
          album: song.album?.name,
        });
      }
    }

    // Step 2: If no high-confidence Genius match, try LRCLib directly
    if (lyricsResult.type === 'none') {
      console.log('[Karaoke] Trying direct LRCLib search...');

      // Only try the cleanest version first to reduce API calls
      const cleanTitle = trackTitle.replace(/\([^)]*\)/g, '').trim();
      
      try {
        lyricsResult = await lrcLibService.getBestLyrics({
          track_name: cleanTitle,
          artist_name: foundArtist,
        });

        if (lyricsResult.type !== 'none') {
          foundTitle = cleanTitle;
          console.log(
            `[Karaoke] Found lyrics directly: ${foundArtist} - ${cleanTitle}`
          );
          
          // Cache successful parameters
          LRCLibService.cacheSuccess(trackId, {
            artist: foundArtist,
            title: cleanTitle,
          });
        }
      } catch (searchError) {
        console.log(`[Karaoke] Direct search failed for "${foundArtist}" - "${cleanTitle}":`, searchError instanceof Error ? searchError.message : 'Unknown error');
      }
    }

    // Step 3: Last resort - try lower confidence Genius matches
    if (lyricsResult.type === 'none' && geniusMatch.found && geniusMatch.song) {
      console.log(
        '[Karaoke] Trying lower confidence Genius match as last resort...'
      );
      song = geniusMatch.song;

      const fullSong = await geniusService.getSongById(song.id);
      if (fullSong) {
        song = fullSong;
      }

      lyricsResult = await lrcLibService.getBestLyrics({
        track_name: song.title,
        artist_name: song.primary_artist.name,
      });
      
      // Cache successful parameters if found
      if (lyricsResult.type !== 'none') {
        LRCLibService.cacheSuccess(trackId, {
          artist: song.primary_artist.name,
          title: song.title,
        });
      }
    }

    if (lyricsResult.type === 'none') {
      return c.json({
        track_id: trackId,
        has_karaoke: false,
        song: song
          ? {
              title: song.title,
              artist: song.primary_artist.name,
              genius_id: song.id.toString(),
              genius_url: song.url,
            }
          : {
              title: foundTitle || trackTitle,
              artist: foundArtist,
            },
        message: song
          ? `Song found but no lyrics available: ${song.primary_artist.name} - ${song.title}`
          : `No lyrics found for: ${foundArtist} - ${trackTitle}`,
        status: 'no_lyrics',
        genius_confidence: song ? 0.5 : 0,
      });
    }

    // Step 4: Format lyrics for karaoke with intelligent timing fixes
    // Debug: Check raw LRCLib data structure
    console.log(
      '[LRCLib] First few raw lyrics:',
      lyricsResult.lyrics?.slice(0, 3)
    );

    const rawLyrics = lyricsResult.lyrics || [];
    let formattedLyrics: any[] = [];

    if (lyricsResult.type === 'synced' && rawLyrics.length > 0) {
      // Additional debug logging before processing
      console.log('[Debug] Raw lyrics structure check:', {
        firstLine: rawLyrics[0],
        hasStartTime: 'startTime' in rawLyrics[0],
        startTimeValue: rawLyrics[0]?.startTime,
        allKeys: Object.keys(rawLyrics[0] || {}),
      });

      // Process synced lyrics with timing improvements
      formattedLyrics = processSyncedLyrics(rawLyrics).map((line, index) => ({
        id: index,
        timestamp: line.timestamp,
        text: cleanLyricsText(line.text),
        duration: line.duration,
        startTime: line.timestamp / 1000,
        endTime: (line.timestamp + (line.duration || 0)) / 1000,
        recordingStart: line.recordingStart,
        recordingEnd: line.recordingEnd,
      }));

      // Check if all timestamps are 0 (invalid synced lyrics)
      const hasValidTimestamps = formattedLyrics.some(
        (line) => line.timestamp > 0
      );
      if (!hasValidTimestamps) {
        console.log(
          '[Karaoke] WARNING: All timestamps are 0, treating as no karaoke available'
        );
        return c.json({
          track_id: trackId,
          has_karaoke: false,
          song: song
            ? {
                title: song.title,
                artist: song.primary_artist.name,
                genius_id: song.id.toString(),
                genius_url: song.url,
              }
            : {
                title: foundTitle || trackTitle,
                artist: foundArtist,
              },
          message:
            'Lyrics found but no synchronized timing available for karaoke',
          status: 'no_synced_lyrics',
          genius_confidence: song ? 0.5 : 0,
        });
      }
    } else if (lyricsResult.type === 'unsynced' && rawLyrics.length > 0) {
      // Unsynced lyrics - we don't support karaoke without timestamps
      console.log(
        '[Karaoke] Found unsynced lyrics, but karaoke requires synchronized timing'
      );
      return c.json({
        track_id: trackId,
        has_karaoke: false,
        song: song
          ? {
              title: song.title,
              artist: song.primary_artist.name,
              genius_id: song.id.toString(),
              genius_url: song.url,
            }
          : {
              title: foundTitle || trackTitle,
              artist: foundArtist,
            },
        message:
          'Lyrics found but no synchronized timing available for karaoke',
        status: 'unsynced_lyrics',
        genius_confidence: song ? 0.5 : 0,
      });
    } else {
      // No lyrics available
      formattedLyrics = [];
    }

    console.log(
      `[Timing] Processed ${formattedLyrics.length} lines with improved timing`
    );

    // Step 5: Track successful song match in database (optional - only if DB exists)
    let isNewDiscovery = false;
    let catalogId: string | null = null;

    if (c.env.DB) {
      try {
        // Check if this song already exists in our catalog
        const existingSong = await c.env.DB.prepare(
          'SELECT id FROM song_catalog WHERE track_id = ?'
        )
          .bind(trackId)
          .first();

        if (existingSong) {
          catalogId = existingSong.id as string;

          // Update existing song stats
          await c.env.DB.prepare(
            `
            UPDATE song_catalog 
            SET total_attempts = total_attempts + 1,
                last_played_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          )
            .bind(catalogId)
            .run();

          console.log(`[Song Tracking] Updated existing song: ${catalogId}`);
        } else {
          // Create new song catalog entry
          catalogId = crypto.randomUUID();
          isNewDiscovery = true;

          const finalTitle = song ? song.title : foundTitle || trackTitle;
          const finalArtist = song ? song.primary_artist.name : foundArtist;
          const difficulty =
            formattedLyrics.length > 50
              ? 'advanced'
              : formattedLyrics.length > 25
                ? 'intermediate'
                : 'beginner';

          await c.env.DB.prepare(
            `
            INSERT INTO song_catalog (
              id, track_id, title, artist, album, duration_ms, difficulty,
              genius_id, genius_url, genius_confidence, soundcloud_match, artwork_url,
              lyrics_source, lyrics_type, lyrics_lines_count, total_attempts,
              unique_users_attempted, last_played_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP)
          `
          )
            .bind(
              catalogId,
              trackId,
              finalTitle,
              finalArtist,
              song?.album?.name || null,
              lyricsResult.metadata?.duration
                ? lyricsResult.metadata.duration * 1000
                : null,
              difficulty,
              song ? song.id.toString() : null,
              song?.url || null,
              song ? geniusMatch.confidence || 0.5 : 0,
              geniusMatch.confidence > 0.9 ? true : false,
              song?.song_art_image_url || null,
              'lrclib',
              lyricsResult.type,
              formattedLyrics.length
            )
            .run();

          console.log(
            `[Song Tracking] Created new song catalog entry: ${catalogId}`
          );
        }

        // Log the match event
        const matchEventId = crypto.randomUUID();
        await c.env.DB.prepare(
          `
          INSERT INTO song_match_events (
            id, track_id, song_catalog_id, search_query, genius_confidence,
            soundcloud_match, match_method, success, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP)
        `
        )
          .bind(
            matchEventId,
            trackId,
            catalogId,
            searchQuery,
            song ? geniusMatch.confidence || 0.5 : 0,
            geniusMatch.confidence > 0.9 ? true : false,
            song
              ? geniusMatch.confidence > 0.9
                ? 'genius_soundcloud'
                : 'genius_similarity'
              : 'lrclib_direct'
          )
          .run();

        console.log(`[Song Tracking] Logged match event: ${matchEventId}`);
      } catch (trackingError) {
        console.error(
          '[Song Tracking] Error tracking song match:',
          trackingError
        );
        // Continue with response even if tracking fails
      }
    }

    // Step 6: No video start time for soundcloak tracks, set to 0
    const trackStartTime = 0;

    const songData = {
      track_id: trackId,
      has_karaoke: true,
      song: song
        ? {
            title: song.title,
            artist: song.primary_artist.name,
            genius_id: song.id.toString(),
            genius_url: song.url,
            album: song.album?.name,
            artwork_url: song.song_art_image_url,
            duration: lyricsResult.metadata?.duration
              ? lyricsResult.metadata.duration * 1000
              : null,
            difficulty:
              formattedLyrics.length > 50
                ? 'advanced'
                : formattedLyrics.length > 25
                  ? 'intermediate'
                  : 'beginner',
            start_time: trackStartTime,
          }
        : {
            title: foundTitle || trackTitle,
            artist: foundArtist,
            duration: lyricsResult.metadata?.duration
              ? lyricsResult.metadata.duration * 1000
              : null,
            difficulty:
              formattedLyrics.length > 50
                ? 'advanced'
                : formattedLyrics.length > 25
                  ? 'intermediate'
                  : 'beginner',
            start_time: trackStartTime,
          },
      lyrics: {
        source: 'lrclib',
        type: lyricsResult.type,
        lines: formattedLyrics,
        total_lines: formattedLyrics.length,
      },
      cache_hit: false,
      genius_confidence: song ? geniusMatch.confidence || 0.5 : 0,
      message: song
        ? `Karaoke ready: ${song.primary_artist.name} - ${song.title}`
        : `Karaoke ready: ${foundArtist} - ${foundTitle || trackTitle}`,
      status: 'success',
      // New tracking metadata
      song_catalog_id: catalogId,
      is_new_discovery: isNewDiscovery,
      match_tracked: !!c.env.DB,
    };

    return c.json(songData);
  } catch (error) {
    console.error('[Karaoke] Error processing track:', error);
    return c.json(
      {
        track_id: trackId,
        has_karaoke: false,
        message: 'Error processing karaoke request',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;