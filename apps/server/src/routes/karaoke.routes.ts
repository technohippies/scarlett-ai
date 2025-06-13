/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import type { Env } from '../types';
import { GeniusService } from '../services/genius.service';
import { LyricsService } from '../services/lyrics.service';
import { ImageService } from '../services/image.service';

const app = new Hono<{ 
  Bindings: Env;
}>();

// Simple LRCLibService wrapper to match the working implementation
class LRCLibService {
  // In-memory cache for development/single instance
  // For production, use Cloudflare KV or Cache API
  private static successCache = new Map<string, { artist: string; title: string; album?: string; timestamp: number }>();
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
    // Cached successful search params
    
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
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      // Using cached search params
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timestamp, ...params } = cached;
      return params;
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
  // Temporarily disable merging to fix jumping issue
  return lyricsService.processSyncedLyrics(rawLyrics, { disableMerging: true });
}

// OPTIONS handled by global CORS middleware

// Core karaoke endpoint - check if track has karaoke data
app.get('/*', async (c) => {
  // Extract track ID from the full path, removing the '/api/karaoke/' prefix
  const fullPath = c.req.url.split('/api/karaoke/')[1];
  const [encodedTrackId] = fullPath.split('?'); // Remove query parameters
  const trackId = decodeURIComponent(encodedTrackId); // Decode the URL-encoded track ID
  const trackTitle = c.req.query('title') || '';
  const artistName = c.req.query('artist') || '';

  try {
    console.log(`[Karaoke] Processing track: ${trackId}`);

    // Check if we have cached successful search parameters
    const cachedParams = await LRCLibService.getCachedSuccess(trackId);
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
        // Found lyrics using cached params

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

    // Searching for track

    // Step 1: Try Genius first to check for SoundCloud URL match (high confidence)
    const geniusService = new GeniusService(c.env.GENIUS_API_KEY || '');
    const lrcLibService = new LRCLibService();

    let geniusMatch;
    try {
      geniusMatch = await geniusService.findSongMatch(searchQuery, trackId);
    } catch (error) {
      console.log('[Karaoke] Genius API error, continuing with LRCLib');
      geniusMatch = { found: false, song: null, confidence: 0 };
    }

    let lyricsResult: any = { type: 'none' };
    let foundTitle = '';
    // foundArtist is already set above from query param or trackId
    foundArtist = foundArtist.replace(/official|music/gi, '').trim();
    let song: any = null;

    if (geniusMatch.found && geniusMatch.song && geniusMatch.confidence > 0.9) {
      // High confidence Genius match (likely SoundCloud URL match)
      console.log('[Karaoke] High confidence Genius match found');
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
        // Including album in search
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
      console.log('[Karaoke] No Genius match, trying direct LRCLib search');
      console.log('[Karaoke] Original artist:', foundArtist, 'title:', trackTitle);

      // Try multiple variations
      const variations = [
        // Clean title without parentheses
        { title: trackTitle.replace(/\([^)]*\)/g, '').trim(), artist: foundArtist },
        // Original title
        { title: trackTitle, artist: foundArtist },
        // Title without artist name if it's included
        { title: trackTitle.replace(new RegExp(foundArtist, 'gi'), '').trim(), artist: foundArtist },
      ];
      
      // Also try different artist variations
      const artistVariations = [
        foundArtist,
        foundArtist.replace(/official|music/gi, '').trim(),
        foundArtist.split(/\s+/)[0], // First word only (e.g., "Kanye" from "Kanye West")
      ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
      
      console.log('[Karaoke] Artist variations:', artistVariations);
      
      for (const { title } of variations) {
        for (const artist of artistVariations) {
          if (!title || !artist) continue;
          
          
          try {
            // Skip cache for direct searches to avoid missing valid results
            const lyricsService = new LyricsService();
            const searchResult = await lyricsService.searchLyrics({
              track_name: title,
              artist_name: artist,
            }, { skipCache: true });
            
            if (searchResult.type !== 'none') {
              lyricsResult = searchResult;
              foundTitle = title;
              foundArtist = artist;
              console.log('[Karaoke] Found lyrics with variation');
              
              // Cache successful parameters
              LRCLibService.cacheSuccess(trackId, {
                artist: artist,
                title: title,
              });
              break;
            }
          } catch (error) {
            console.log(`[Karaoke] Error searching variation: ${error}`);
          }
        }
        if (lyricsResult.type !== 'none') break;
      }
    }

    // Step 3: Last resort - try lower confidence Genius matches
    if (lyricsResult.type === 'none' && geniusMatch.found && geniusMatch.song) {
      // Trying lower confidence Genius match
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
    // Process raw lyrics

    const rawLyrics = lyricsResult.lyrics || [];
    let formattedLyrics: any[] = [];

    if (lyricsResult.type === 'synced' && rawLyrics.length > 0) {
      // Process synced lyrics

      // Process synced lyrics with timing improvements
      const processedLyrics = processSyncedLyrics(rawLyrics);
      
      // Process lyrics
      
      formattedLyrics = processedLyrics.map((line, index) => ({
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
        console.log('[Karaoke] WARNING: Invalid timestamps');
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
      console.log('[Karaoke] Found unsynced lyrics');
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

    // Processed lyrics with timing

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

          // Updated existing song
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

          console.log('[Song Tracking] Created new song catalog entry');
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

        // Logged match event
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

// Start a new karaoke session
app.post('/start', async (c) => {
  // Start karaoke session
  
  const body = await c.req.json();
  const { trackId, songData, songCatalogId } = body;
  
  // TODO: Get from auth when implemented
  // For testing, use a test user ID - create this user in your database first
  const userId = 'test-user-1'; // Temporary for testing practice cards
  
  try {
    // Check if DB is available
    if (c.env.DB) {
      // First, ensure the song exists in the catalog
      let catalogId = songCatalogId;
      
      if (!catalogId) {
        // Check if song already exists in catalog
        const existing = await c.env.DB
          .prepare('SELECT id FROM song_catalog WHERE track_id = ?')
          .bind(trackId)
          .first<{ id: string }>();
          
        if (existing) {
          catalogId = existing.id;
        } else {
          // Create a new catalog entry
          catalogId = crypto.randomUUID();
          const difficulty = songData.difficulty || 'intermediate';
          
          await c.env.DB.prepare(
            `
            INSERT INTO song_catalog (
              id, track_id, title, artist, album, duration_ms, difficulty,
              genius_id, lyrics_source, lyrics_type, total_attempts,
              unique_users_attempted, last_played_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lrclib', 'synced', 1, 1, CURRENT_TIMESTAMP)
            `
          )
          .bind(
            catalogId,
            trackId,
            songData.title,
            songData.artist,
            songData.album || null,
            songData.duration || null,
            difficulty,
            songData.geniusId || null
          )
          .run();
          
          console.log('[Karaoke] Created song catalog entry for session start:', catalogId);
        }
      }
      
      const sessionService = new (await import('../services/session.service')).SessionService(c.env);
      const session = await sessionService.createSession(
        userId,
        trackId,
        {
          title: songData.title,
          artist: songData.artist,
          geniusId: songData.geniusId,
          duration: songData.duration,
          difficulty: songData.difficulty,
          catalogId
        }
      );
      
      return c.json({
        success: true,
        data: {
          id: session.id,
          trackId: session.trackId,
          status: session.status,
          createdAt: session.createdAt,
        }
      });
    } else {
      // Fallback for development without DB
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('[Karaoke] Creating mock session (no DB)');
      
      return c.json({
        success: true,
        data: {
          id: sessionId,
          trackId: trackId,
          status: 'active',
          createdAt: new Date().toISOString(),
        }
      });
    }
  } catch (error) {
    console.error('[Karaoke] Error starting session:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start session'
    }, 500);
  }
});

// Grade a line recording
app.post('/grade', async (c) => {
  const body = await c.req.json();
  const { sessionId, lineIndex, audioBuffer, expectedText, startTime, endTime } = body;
  
  
  try {
    // Convert base64 audio to buffer
    const audioData = Uint8Array.from(atob(audioBuffer), char => char.charCodeAt(0));
    // Process audio buffer
    
    // Get STT transcription
    const sttService = new (await import('../services/stt.service')).STTService(c.env);
    const transcription = await sttService.transcribeAudio(audioData);
    
    // Grade the transcription
    const scoringService = new (await import('../services/scoring.service')).ScoringService();
    const scoreResult = scoringService.calculateKaraokeScore(expectedText, transcription.transcript);
    
    // Log comparison for debugging
    console.log('[Karaoke] Comparison:', {
      expected: expectedText,
      transcribed: transcription.transcript,
      score: scoreResult.finalScore
    });
    
    // Generate feedback
    const feedback = scoringService.generateFeedback(
      scoreResult.finalScore,
      expectedText,
      transcription.transcript,
      1 // attempt number, could be tracked per session
    );
    
    // Record the line score if DB available
    if (c.env.DB) {
      const sessionService = new (await import('../services/session.service')).SessionService(c.env);
      await sessionService.recordLineScore(sessionId, {
        lineIndex,
        expectedText,
        transcribedText: transcription.transcript,
        score: scoreResult.finalScore,
        feedback: feedback,
        attemptNumber: 1
      });
    } else {
      // Skipping DB storage (no DB available)
    }
    
    // Scoring complete
    
    return c.json({
      success: true,
      data: {
        score: scoreResult.finalScore,
        transcript: transcription.transcript,
        feedback: feedback,
        wordScores: scoreResult.wordScores,
      }
    });
  } catch (error) {
    console.error('[Karaoke] Error grading recording:', error);
    
    // If STT services are overloaded, return a neutral score instead of failing
    if (error instanceof Error && error.message.includes('STT services failed')) {
      console.log('[Karaoke] STT services unavailable, returning neutral score');
      return c.json({
        success: true,
        data: {
          score: 70, // Neutral score
          transcript: '',
          feedback: 'Recording received but transcription service is temporarily unavailable. Keep going! 🎵',
          wordScores: [],
        },
        error: 'STT temporarily unavailable'
      });
    }
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to grade recording'
    }, 500);
  }
});

// Complete karaoke session
app.post('/complete', async (c) => {
  const body = await c.req.json();
  const { sessionId, fullAudioBuffer } = body;
  
  
  try {
    let finalScore = 0;
    let elevenLabsTranscript = '';
    
    // Process full audio with ElevenLabs if provided
    if (fullAudioBuffer && c.env.ELEVENLABS_API_KEY) {
      try {
        
        // Convert base64 to Uint8Array
        const audioData = Uint8Array.from(atob(fullAudioBuffer), c => c.charCodeAt(0));
        
        // Get STT service to use ElevenLabs for transcription
        const sttService = new (await import('../services/stt.service')).STTService(c.env);
        
        // For full session, we don't have expected text, so just transcribe
        const transcriptionResult = await sttService.transcribeAudio(audioData);
        elevenLabsTranscript = transcriptionResult.transcript;
        
        
        // TODO: Implement full session scoring logic
        // For now, use the confidence as a basis for the score
        finalScore = Math.round(transcriptionResult.confidence * 100);
      } catch (error) {
        console.error('[Karaoke] Failed to process full audio with ElevenLabs:', error);
      }
    }
    
    if (c.env.DB) {
      const sessionService = new (await import('../services/session.service')).SessionService(c.env);
      
      // Complete the session and calculate final score
      const result = await sessionService.completeSession(sessionId, null, finalScore || undefined);
      
      // Create practice cards for lines with errors
      try {
        // Get session details and line scores
        const session = await c.env.DB
          .prepare('SELECT user_id FROM karaoke_sessions WHERE id = ?')
          .bind(sessionId)
          .first<{ user_id: string }>();
        
        if (session?.user_id) {
          // Get line scores for this session
          const lineScores = await c.env.DB
            .prepare(`
              SELECT line_index, line_text, score, transcribed_text
              FROM line_scores
              WHERE session_id = ?
              ORDER BY line_index
            `)
            .bind(sessionId)
            .all();
          
          if (lineScores.results && lineScores.results.length > 0) {
            // First ensure the song exists in the catalog
            const sessionDetails = await c.env.DB
              .prepare('SELECT track_id FROM karaoke_sessions WHERE id = ?')
              .bind(sessionId)
              .first<{ track_id: string }>();
            
            if (sessionDetails) {
              const songCatalog = await c.env.DB
                .prepare('SELECT id FROM song_catalog WHERE track_id = ?')
                .bind(sessionDetails.track_id)
                .first<{ id: string }>();
              
              if (!songCatalog) {
                console.warn('[Karaoke] Song catalog entry not found for track_id:', sessionDetails.track_id);
                console.warn('[Karaoke] Skipping practice card creation for session:', sessionId);
              } else {
                const practiceService = (await import('../services/practice.service')).createPracticeService(c.env.DB, c.env);
                await practiceService.processSessionErrors(
                  sessionId,
                  session.user_id,
                  lineScores.results as any[]
                );
                console.log('[Karaoke] Created practice cards for session:', sessionId);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Karaoke] Failed to create practice cards:', error);
        // Don't fail the completion if practice card creation fails
      }
      
      return c.json({
        success: true,
        data: {
          finalScore: finalScore || result.finalScore,
          totalLines: result.totalLines,
          perfectLines: result.perfectLines,
          goodLines: result.goodLines,
          needsWorkLines: result.needsWorkLines,
          accuracy: result.accuracy,
          sessionId: result.sessionId,
          elevenLabsTranscript: elevenLabsTranscript || undefined
        }
      });
    } else {
      // Mock response for development - use ElevenLabs score if available
      return c.json({
        success: true,
        data: {
          finalScore: finalScore || 85,
          totalLines: 3, // Test mode with 3 lines
          perfectLines: finalScore >= 90 ? 2 : 1,
          goodLines: finalScore >= 70 ? 2 : 1,
          needsWorkLines: finalScore < 70 ? 1 : 0,
          accuracy: finalScore || 85,
          sessionId: sessionId,
          elevenLabsTranscript: elevenLabsTranscript || undefined
        }
      });
    }
  } catch (error) {
    console.error('[Karaoke] Error completing session:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete session'
    }, 500);
  }
});

export default app;