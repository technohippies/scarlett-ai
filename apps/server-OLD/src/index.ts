import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { nanoid } from 'nanoid';
import { authMiddleware, type AuthContext, type Env } from './auth';
import authRoutes from './routes/auth';
import farcasterAuthRoutes from './routes/auth-farcaster';
import popularSongsRoutes from './routes/popular-songs';
import { leaderboardRouter } from './routes/leaderboard';
import { GeniusService, LRCLibService } from './services/index.js';
import {
  cleanLyricsText,
  processSyncedLyrics,
  mergeShortLines,
} from './services/lyrics';
import {
  calculateKaraokeScore,
  calculateKaraokeScoreWithWords,
  calculatePhoneticSimilarity,
  calculateStringSimilarity,
  calculateSequenceBonus,
  generateFeedback,
} from './services/scoring';
import {
  transcribeWithDeepgram,
  transcribeWithElevenLabs,
  transcribeWithElevenLabsRaw,
  performForcedAlignment,
} from './services/stt';
import {
  alignTranscriptWithOffset,
  calculateOverallScore,
  gradeSessionWithHybridApproach,
} from './services/session-grading';
import { generateKaraokeFeedback } from './services/coaching';
import { buildTutorAnalysisPrompt } from './prompts/tutor-analysis';
import type { TutorAnalysisRequest } from './prompts/tutor-types';
import { simpleKaraokeLookup } from './simple-karaoke';

type Bindings = Env & {
  GENIUS_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DEEPGRAM_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Initialize LRCLib service (doesn't need API key)
const lrcLibService = new LRCLibService();

// Helper function to update user's best score
async function updateUserBestScore(
  db: any,
  userId: string,
  songId: string,
  newScore: number,
  sessionId: string
): Promise<void> {
  try {
    // Check if user already has a best score for this song
    const existing = await db
      .prepare(
        `SELECT id, best_score FROM user_best_scores 
         WHERE user_id = ? AND song_id = ?`
      )
      .bind(userId, songId)
      .first();

    if (!existing) {
      // First time playing this song
      await db
        .prepare(
          `INSERT INTO user_best_scores 
           (id, user_id, song_id, best_score, best_session_id, 
            achieved_at, total_attempts, average_score, last_played_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, CURRENT_TIMESTAMP)`
        )
        .bind(nanoid(), userId, songId, newScore, sessionId, newScore)
        .run();
      
      console.log(`[BestScore] New song record for user ${userId}: ${newScore}`);
    } else if (newScore > existing.best_score) {
      // New best score!
      await db
        .prepare(
          `UPDATE user_best_scores 
           SET best_score = ?, 
               best_session_id = ?, 
               achieved_at = CURRENT_TIMESTAMP,
               total_attempts = total_attempts + 1,
               average_score = ((average_score * (total_attempts - 1)) + ?) / total_attempts,
               last_played_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(newScore, sessionId, newScore, existing.id)
        .run();
      
      console.log(`[BestScore] New personal best for user ${userId}: ${newScore} (was ${existing.best_score})`);
    } else {
      // Not a new best, just update attempts and average
      await db
        .prepare(
          `UPDATE user_best_scores 
           SET total_attempts = total_attempts + 1,
               average_score = ((average_score * (total_attempts - 1)) + ?) / total_attempts,
               last_played_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(newScore, existing.id)
        .run();
      
      console.log(`[BestScore] Score recorded for user ${userId}: ${newScore} (best: ${existing.best_score})`);
    }
  } catch (error) {
    console.error('[BestScore] Failed to update best score:', error);
    throw error;
  }
}

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',
      'https://scarlettx.xyz',
      'https://sc.maid.zone',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
  })
);

// Manual CORS headers as fallback
app.use('*', async (c, next) => {
  // Set CORS headers manually
  c.header('Access-Control-Allow-Origin', '*'); // Allow all origins for development
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// Health check
app.get('/', (c) => {
  return c.json({
    message: '🎤 Scarlett Karaoke API',
    version: '1.0.0',
    environment: 'development',
  });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Speech-to-Text endpoint for extension onboarding
app.post('/api/speech-to-text', async (c) => {
  try {
    console.log('[STT] Processing speech-to-text request');

    // Get the uploaded audio file
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || typeof audioFile === 'string') {
      return c.json(
        {
          success: false,
          error: 'No audio file provided',
          text: null,
        },
        400
      );
    }

    // At this point, audioFile is guaranteed to be a File
    const file = audioFile as File;
    console.log(
      `[STT] Audio file size: ${file.size} bytes, type: ${file.type}`
    );

    // Try Deepgram first
    const deepgramApiKey = c.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      try {
        console.log('[STT] Using Deepgram for transcription');
        const audioBuffer = await file.arrayBuffer();

        // Simple transcription without keyterm priming for onboarding
        const deepgramResult = await transcribeWithDeepgram(
          new Uint8Array(audioBuffer),
          '', // No expected text for general STT
          deepgramApiKey
        );

        console.log(
          `[STT] Deepgram transcript: "${deepgramResult.transcript}"`
        );

        return c.json({
          success: true,
          text: deepgramResult.transcript,
          confidence: deepgramResult.confidence,
          processing_time: null,
          provider: 'deepgram',
        });
      } catch (deepgramError) {
        console.error('[STT] Deepgram error:', deepgramError);
        // Fall through to ElevenLabs
      }
    }

    // Fallback to ElevenLabs
    const elevenlabsApiKey = c.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      console.error('[STT] No API keys configured for STT');
      return c.json(
        {
          success: false,
          error: 'STT service not configured',
          text: null,
        },
        500
      );
    }

    console.log('[STT] Falling back to ElevenLabs');
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('file', file, 'audio.wav');
    elevenLabsFormData.append('model_id', 'scribe_v1');

    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        },
        body: elevenLabsFormData,
      }
    );

    if (!response.ok) {
      let errorBody = '';
      try {
        const errorData = (await response.json()) as any;
        errorBody =
          errorData.detail?.message ||
          errorData.detail ||
          JSON.stringify(errorData);
      } catch (e) {
        errorBody = await response.text();
      }
      console.error(
        `[STT] ElevenLabs API error: ${response.status} ${response.statusText}. Body: ${errorBody}`
      );
      return c.json(
        {
          success: false,
          error: `Speech recognition service error: ${response.status}: ${errorBody}`,
          text: null,
        },
        500
      );
    }

    const result = (await response.json()) as {
      text?: string;
      confidence?: number;
      processing_time?: number;
    };
    const transcript = result.text || '';

    console.log(`[STT] ElevenLabs transcript: "${transcript}"`);

    return c.json({
      success: true,
      text: transcript,
      confidence: result.confidence || null,
      processing_time: result.processing_time || null,
      provider: 'elevenlabs',
    });
  } catch (error) {
    console.error('[STT] Error processing speech-to-text:', error);
    return c.json(
      {
        success: false,
        error: 'Internal server error during speech processing',
        text: null,
      },
      500
    );
  }
});

// Core karaoke endpoint - check if track has karaoke data
app.get('/api/karaoke/*', async (c) => {
  // Extract track ID from the full path, removing the '/api/karaoke/' prefix
  const fullPath = c.req.url.split('/api/karaoke/')[1];
  const [trackId] = fullPath.split('?'); // Remove query parameters
  const trackTitle = c.req.query('title') || '';
  const artistName = c.req.query('artist') || '';

  try {
    console.log(
      `[Karaoke] Processing track: ${trackId}, title: "${trackTitle}", artist: "${artistName}"`
    );

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
    const geniusService = new GeniusService(c.env.GENIUS_API_KEY || 'demo-key');
    const lrcLibService = new LRCLibService();

    const geniusMatch = await geniusService.findVideoMatch(
      searchQuery,
      trackId
    );

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
    }

    // Step 2: If no high-confidence Genius match, try LRCLib directly
    if (lyricsResult.type === 'none') {
      console.log('[Karaoke] Trying direct LRCLib search...');

      const titleVariants = [
        trackTitle.replace(/\([^)]*\)/g, '').trim(), // "Superman"
        trackTitle.split('(')[0].trim(), // "Superman"
        trackTitle, // "Superman (feat. Dina Rae)"
      ];

      for (const title of titleVariants) {
        if (title) {
          lyricsResult = await lrcLibService.getBestLyrics({
            track_name: title,
            artist_name: foundArtist,
          });

          if (lyricsResult.type !== 'none') {
            foundTitle = title;
            console.log(
              `[Karaoke] Found lyrics directly: ${foundArtist} - ${title}`
            );
            break;
          }
        }
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

    // Step 3: Format lyrics for karaoke with intelligent timing fixes
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

    // Step 4: Track successful song match in database
    let isNewDiscovery = false;
    let catalogId: string | null = null;

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

    // Step 5: No video start time for soundcloak tracks, set to 0
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
      genius_confidence: song ? 0.5 : 0,
      message: song
        ? `Karaoke ready: ${song.primary_artist.name} - ${song.title}`
        : `Karaoke ready: ${foundArtist} - ${foundTitle || trackTitle}`,
      status: 'success',
      // New tracking metadata
      song_catalog_id: catalogId,
      is_new_discovery: isNewDiscovery,
      match_tracked: true,
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

// Grade audio performance
app.post('/api/grade-audio', async (c) => {
  try {
    const body = await c.req.json();
    const {
      audio_data: _audio_data,
      expected_text: _expected_text,
      session_id,
    } = body;

    // TODO: Implement actual grading
    // 1. Process audio blob
    // 2. Send to ElevenLabs API for scoring
    // 3. Generate character response via Venice AI
    // 4. Return combined feedback

    // Mock response for now
    const mockGrading = {
      session_id,
      line_score: 85,
      pronunciation_score: 78,
      timing_score: 92,
      overall_score: 85,
      character_response:
        "Great job! Your pronunciation of 'strangers' was excellent! 🎵",
      feedback: {
        strengths: ['Good timing', 'Clear pronunciation'],
        improvements: ["Try to hold the note longer on 'love'"],
        next_tip: 'Focus on breathing between phrases',
      },
      processing_time: 1200, // ms
      timestamp: new Date().toISOString(),
    };

    return c.json(mockGrading);
  } catch {
    return c.json({ error: 'Failed to process audio' }, 400);
  }
});

// Get song lyrics (cached endpoint)
app.get('/api/song/:songId/lyrics', async (c) => {
  const songId = c.req.param('songId');

  // TODO: Return cached lyrics from database/storage
  const mockLyrics = {
    song_id: songId,
    lines: [
      { timestamp: 0, text: "We're no strangers to love", duration: 3000 },
      {
        timestamp: 3000,
        text: 'You know the rules and so do I',
        duration: 3500,
      },
      // ... full lyrics
    ],
    cached_at: new Date().toISOString(),
    source: 'lrclib',
  };

  return c.json(mockLyrics);
});

// Get song match analytics
app.get('/api/analytics/songs', async (c) => {
  try {
    // Get top matched songs
    const topSongs = await c.env.DB.prepare(
      `
      SELECT track_id, title, artist, total_attempts, total_completions, 
             success_rate, unique_users_attempted, last_played_at
      FROM song_catalog 
      ORDER BY total_attempts DESC 
      LIMIT 20
    `
    ).all();

    // Get recent discoveries (new songs added in last 7 days)
    const recentDiscoveries = await c.env.DB.prepare(
      `
      SELECT track_id, title, artist, created_at, total_attempts
      FROM song_catalog 
      WHERE created_at > datetime('now', '-7 days')
      ORDER BY created_at DESC 
      LIMIT 10
    `
    ).all();

    // Get match statistics
    const matchStats = await c.env.DB.prepare(
      `
      SELECT 
        COUNT(*) as total_matches,
        COUNT(DISTINCT track_id) as unique_songs,
        COUNT(CASE WHEN match_method = 'genius_soundcloud' THEN 1 END) as soundcloud_matches,
        COUNT(CASE WHEN match_method = 'lrclib_direct' THEN 1 END) as direct_matches
      FROM song_match_events 
      WHERE success = true
    `
    ).first();

    return c.json({
      success: true,
      analytics: {
        top_songs: topSongs.results,
        recent_discoveries: recentDiscoveries.results,
        match_statistics: matchStats,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Analytics] Error fetching song analytics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch song analytics',
      },
      500
    );
  }
});

// Get trending/popular songs for public display
app.get('/api/songs/trending', async (c) => {
  try {
    const timeframe = c.req.query('timeframe') || '7d'; // 7d, 30d, all
    const limit = parseInt(c.req.query('limit') || '20');

    let dateFilter = '';
    switch (timeframe) {
      case '24h':
        dateFilter = "AND last_played_at > datetime('now', '-1 day')";
        break;
      case '7d':
        dateFilter = "AND last_played_at > datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND last_played_at > datetime('now', '-30 days')";
        break;
      case 'all':
      default:
        dateFilter = '';
        break;
    }

    // Get trending songs with rich metadata for display
    const trendingSongs = await c.env.DB.prepare(
      `
      SELECT 
        track_id,
        title,
        artist,
        album,
        artwork_url,
        difficulty,
        duration_ms,
        lyrics_type,
        lyrics_lines_count,
        total_attempts,
        total_completions,
        success_rate,
        unique_users_attempted,
        last_played_at,
        created_at
      FROM song_catalog 
      WHERE total_attempts > 0 ${dateFilter}
      ORDER BY 
        CASE 
          WHEN '${timeframe}' = 'all' THEN total_attempts
          ELSE unique_users_attempted * 2 + total_attempts
        END DESC,
        last_played_at DESC
      LIMIT ?
    `
    )
      .bind(limit)
      .all();

    // Get recently added songs (for discovery section)
    const recentlyAdded = await c.env.DB.prepare(
      `
      SELECT 
        track_id,
        title,
        artist,
        album,
        artwork_url,
        difficulty,
        duration_ms,
        lyrics_type,
        created_at
      FROM song_catalog 
      WHERE created_at > datetime('now', '-14 days')
      ORDER BY created_at DESC 
      LIMIT 10
    `
    ).all();

    return c.json({
      success: true,
      timeframe,
      trending_songs: trendingSongs.results,
      recently_added: recentlyAdded.results,
      total_songs: trendingSongs.results.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trending] Error fetching trending songs:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch trending songs',
      },
      500
    );
  }
});

// Types for karaoke system
type KaraokeSession = {
  session_id: string;
  track_id: string;
  song: {
    title: string;
    artist: string;
    genius_id: string;
  };
  created_at: string;
  current_line: number;
  line_scores: Record<number, LineScore>;
  status: 'active' | 'paused' | 'completed';
};

type LineScore = {
  score: number; // 0-100
  feedback: string;
  attempts: number;
  timestamp: string;
};

type AudioSubmission = {
  session_id: string;
  line_index: number;
  audio_data: string; // base64 encoded audio blob
  expected_text: string;
  attempt_number: number;
};

type GradingResponse = {
  session_id: string;
  line_index: number;
  score: number;
  feedback: string;
  attempts: number;
  character_response?: string;
  processing_time: number;
  timestamp: string;
  transcribed_text?: string; // For debugging
};

// In-memory session store (would be replaced with D1 or KV in production)
const sessions = new Map<string, KaraokeSession>();

// Create karaoke session from track (Farcaster compatibility)
app.post('/api/karaoke/match', async (c) => {
  try {
    console.log('[Karaoke Match] Processing match request');
    const body = await c.req.json();
    const { url, platform } = body;

    console.log('[Karaoke Match] Request data:', { url, platform });

    // Extract track_id from URL
    let trackId = '';
    if (url.startsWith('track://')) {
      trackId = url.replace('track://', '');
    } else if (url.includes('maid.zone/')) {
      trackId = url.split('maid.zone/')[1];
    } else {
      trackId = url;
    }

    console.log('[Karaoke Match] Extracted track_id:', trackId);

    // Create a session ID
    const sessionId = crypto.randomUUID();

    // Try to get song from catalog
    const song = await c.env.DB.prepare(
      'SELECT * FROM song_catalog WHERE track_id = ?'
    )
      .bind(trackId)
      .first();

    if (song) {
      console.log('[Karaoke Match] Found song in catalog:', song.title);

      // Return session with song data
      return c.json({
        success: true,
        session: {
          id: sessionId,
          userId: 'farcaster_user',
          songTitle: song.title,
          artistName: song.artist,
          startedAt: new Date().toISOString(),
          platform: platform || 'farcaster',
        },
        song: {
          title: song.title,
          artist: song.artist,
          track_id: song.track_id,
          audioUrl: song.soundcloud_url || `https://maid.zone/${song.track_id}`,
        },
      });
    } else {
      // Return a basic session for unknown songs
      console.log(
        '[Karaoke Match] Song not found in catalog, creating basic session'
      );
      return c.json({
        success: true,
        session: {
          id: sessionId,
          userId: 'farcaster_user',
          songTitle: 'Unknown Song',
          artistName: 'Unknown Artist',
          startedAt: new Date().toISOString(),
          platform: platform || 'farcaster',
        },
        song: {
          title: 'Unknown Song',
          artist: 'Unknown Artist',
          track_id: trackId,
          audioUrl: `https://maid.zone/${trackId}`,
        },
      });
    }
  } catch (error) {
    console.error('[Karaoke Match] Error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to create karaoke session',
      },
      500
    );
  }
});

// Start karaoke session
app.post('/api/karaoke/start', authMiddleware, async (c: AuthContext) => {
  try {
    console.log('[Karaoke Start] Processing karaoke session start request');
    const body = await c.req.json();
    const { track_id, song_data } = body;

    console.log('[Karaoke Start] Request data:', {
      track_id,
      song_title: song_data?.title,
      song_artist: song_data?.artist,
      user_id: c.user?.id,
    });

    if (!c.user) {
      console.error('[Karaoke Start] User not found in context');
      return c.json(
        {
          success: false,
          error: 'Authentication required',
        },
        401
      );
    }

    if (!song_data?.title || !song_data?.artist) {
      console.error('[Karaoke Start] Missing required song data');
      return c.json(
        {
          success: false,
          error: 'Missing required song data (title and artist)',
        },
        400
      );
    }

    const session_id = crypto.randomUUID();
    console.log('[Karaoke Start] Generated session ID:', session_id);

    // Store in database
    try {
      await c.env.DB.prepare(
        `
        INSERT INTO karaoke_sessions 
        (id, user_id, track_id, song_title, song_artist, song_genius_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `
      )
        .bind(
          session_id,
          c.user.id,
          track_id,
          song_data.title,
          song_data.artist,
          song_data.genius_id || null
        )
        .run();

      console.log('[Karaoke Start] ✅ Session stored in database successfully');
    } catch (dbError) {
      console.error('[Karaoke Start] ❌ Database error:', dbError);
      return c.json(
        {
          success: false,
          error: 'Failed to create session in database',
        },
        500
      );
    }

    // Keep backward compatibility with in-memory sessions for now
    const session: KaraokeSession = {
      session_id,
      track_id,
      song: {
        title: song_data.title,
        artist: song_data.artist,
        genius_id: song_data.genius_id,
      },
      created_at: new Date().toISOString(),
      current_line: 0,
      line_scores: {},
      status: 'active',
    };

    sessions.set(session_id, session);
    console.log(
      '[Karaoke Start] ✅ Session stored in memory for backward compatibility'
    );

    return c.json({
      success: true,
      session_id,
      message: `Karaoke session started for ${song_data.artist} - ${song_data.title}`,
      session,
      database_stored: true,
    });
  } catch (error) {
    console.error('[Karaoke Start] ❌ Unexpected error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to start karaoke session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Submit audio for grading
app.post('/api/karaoke/grade', authMiddleware, async (c: AuthContext) => {
  try {
    console.log('[Karaoke Grade] Processing grading request');
    const body: AudioSubmission = await c.req.json();
    const {
      session_id,
      line_index,
      audio_data,
      expected_text,
      attempt_number,
    } = body;

    console.log('[Karaoke Grade] Submission data:', {
      session_id,
      line_index,
      expected_text,
      attempt_number,
      user_id: c.user?.id,
      audio_data_length: audio_data ? audio_data.length : 0,
      has_audio: !!audio_data,
    });

    if (!c.user) {
      console.error('[Karaoke Grade] User not found in context');
      return c.json(
        {
          success: false,
          error: 'Authentication required',
        },
        401
      );
    }

    const session = sessions.get(session_id);
    if (!session) {
      console.error('[Karaoke Grade] Session not found in memory:', session_id);
      return c.json(
        {
          success: false,
          error: 'Session not found',
        },
        404
      );
    }

    // Verify session exists in database and belongs to user
    const dbSession = await c.env.DB.prepare(
      `
      SELECT id, user_id, song_title, song_artist 
      FROM karaoke_sessions 
      WHERE id = ? AND user_id = ?
    `
    )
      .bind(session_id, c.user.id)
      .first();

    if (!dbSession) {
      console.error(
        '[Karaoke Grade] Session not found in database or unauthorized access'
      );
      return c.json(
        {
          success: false,
          error: 'Session not found or unauthorized',
        },
        404
      );
    }

    console.log('[Karaoke Grade] ✅ Session verified in database');

    console.log(
      `[Karaoke] Grading line ${line_index}: "${expected_text}" (attempt ${attempt_number})`
    );

    // Use Deepgram for transcription
    const deepgramApiKey = c.env.DEEPGRAM_API_KEY;
    let transcribedText = '';
    let wordTimings: Array<{
      word: string;
      start: number;
      end: number;
      confidence: number;
    }> = [];
    let transcriptionConfidence = 0;
    let processingTime = Date.now();

    console.log('[Karaoke Grade] STT check:', {
      has_deepgram_key: !!deepgramApiKey,
      deepgram_key_length: deepgramApiKey ? deepgramApiKey.length : 0,
      has_audio_data: !!audio_data,
      audio_data_length: audio_data ? audio_data.length : 0,
      will_use_deepgram: !!(deepgramApiKey && audio_data),
    });

    if (deepgramApiKey && audio_data) {
      try {
        console.log('[Karaoke Grade] Attempting Deepgram transcription...');
        console.log(
          '[Karaoke Grade] Audio data (base64) length:',
          audio_data.length
        );

        // Decode base64 audio data
        const audioBuffer = Uint8Array.from(atob(audio_data), (c) =>
          c.charCodeAt(0)
        ).buffer;

        console.log(
          '[Karaoke Grade] Decoded audio buffer size:',
          audioBuffer.byteLength,
          'bytes'
        );

        // Use Deepgram for transcription with keyterm priming
        const deepgramResult = await transcribeWithDeepgram(
          new Uint8Array(audioBuffer),
          expected_text,
          deepgramApiKey
        );

        transcribedText = deepgramResult.transcript;
        wordTimings = deepgramResult.words;
        transcriptionConfidence = deepgramResult.confidence;

        console.log(`[Karaoke] Deepgram transcript: "${transcribedText}"`);
        console.log(
          `[Karaoke] Word count: ${wordTimings.length}, Confidence: ${transcriptionConfidence.toFixed(2)}`
        );

        // Log if we're stripping parenthetical content
        const strippedText = transcribedText.replace(/\([^)]*\)/g, '').trim();
        if (strippedText !== transcribedText) {
          console.log(
            `[Karaoke] After stripping parentheses: "${strippedText}"`
          );
        }
      } catch (error) {
        console.error('[Karaoke] Deepgram transcription error:', error);
        console.error('[Karaoke] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
        });

        // Fallback to ElevenLabs if available and Deepgram fails
        const elevenlabsApiKey = c.env.ELEVENLABS_API_KEY;
        if (elevenlabsApiKey) {
          console.log('[Karaoke] Falling back to ElevenLabs...');
          try {
            const audioBuffer = Uint8Array.from(atob(audio_data), (c) =>
              c.charCodeAt(0)
            );
            const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');
            formData.append('model_id', 'scribe_v1');
            formData.append('language_code', 'en');

            const response = await fetch(
              'https://api.elevenlabs.io/v1/speech-to-text',
              {
                method: 'POST',
                headers: {
                  'xi-api-key': elevenlabsApiKey,
                },
                body: formData,
              }
            );

            if (response.ok) {
              const result = (await response.json()) as { text?: string };
              transcribedText = result.text || '';
              console.log(
                `[Karaoke] ElevenLabs fallback transcript: "${transcribedText}"`
              );
            }
          } catch (fallbackError) {
            console.error(
              '[Karaoke] ElevenLabs fallback error:',
              fallbackError
            );
          }
        }
      }
    }

    const sttProcessingTime = Date.now() - processingTime;
    console.log(`[Karaoke Grade] 🎵 STT completed in ${sttProcessingTime}ms`);

    // Calculate score based on text similarity and word-level analysis
    const scoringStart = Date.now();
    const { finalScore, wordScores } = calculateKaraokeScoreWithWords(
      expected_text,
      transcribedText,
      wordTimings,
      attempt_number
    );
    const scoringTime = Date.now() - scoringStart;

    const feedback = !transcribedText.trim()
      ? "I couldn't hear you clearly. Try speaking louder! 🎤"
      : generateFeedback(
          finalScore,
          expected_text,
          transcribedText,
          attempt_number
        );

    console.log(
      `[Karaoke Grade] 📊 Score calculated: ${finalScore}/100 (${scoringTime}ms)`
    );

    // Generate a unique attempt ID for database storage
    const attemptId = crypto.randomUUID();
    console.log(
      '[Karaoke Grade] 💾 Storing line attempt in database...',
      attemptId
    );

    // Store line attempt in database
    try {
      await c.env.DB.prepare(
        `
        INSERT INTO line_scores 
        (id, session_id, line_index, line_text, score, transcribed_text, 
         attempt_number, processing_time_ms, feedback_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
        .bind(
          attemptId,
          session_id,
          line_index,
          expected_text,
          finalScore,
          transcribedText,
          attempt_number,
          sttProcessingTime,
          feedback
        )
        .run();

      console.log('[Karaoke Grade] ✅ Line attempt stored in database');
    } catch (dbError) {
      console.error(
        '[Karaoke Grade] ❌ Database error storing line attempt:',
        dbError
      );
      // Continue with request but log error
    }

    // Extract and analyze words for vocabulary learning
    // TODO: Disabled until word extraction tables are added to main schema
    // console.log('[Karaoke Grade] 🔤 Extracting words for vocabulary analysis...');
    // try {
    //   await extractAndStoreWords(attemptId, expected_text, transcribedText, c.env.DB);
    //   console.log('[Karaoke Grade] ✅ Word extraction completed');
    // } catch (wordError) {
    //   console.error('[Karaoke Grade] ❌ Error in word extraction:', wordError);
    //   // Continue with request but log error
    // }

    // Store the score (backward compatibility)
    const lineScore: LineScore = {
      score: finalScore,
      feedback,
      attempts: attempt_number,
      timestamp: new Date().toISOString(),
    };

    session.line_scores[line_index] = lineScore;
    session.current_line = line_index;

    const totalProcessingTime =
      Date.now() - (Date.now() - sttProcessingTime - scoringTime);
    console.log(
      `[Karaoke Grade] ⏱️ Total processing time: ${totalProcessingTime}ms`
    );

    const response: GradingResponse = {
      session_id,
      line_index,
      score: finalScore,
      feedback,
      attempts: attempt_number,
      character_response: generateCharacterResponse(finalScore, expected_text),
      processing_time: totalProcessingTime,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Karaoke] Line ${line_index} scored: ${finalScore}/100`);

    return c.json({
      success: true,
      ...response,
      transcribed_text: transcribedText, // Include for debugging
      word_timings: wordTimings, // Word-level timing data
      word_scores: wordScores, // Word-by-word scoring
      transcription_confidence: transcriptionConfidence,
      database_stored: true,
      word_extraction_completed: false, // Disabled until schema updated
    });
  } catch (error) {
    console.error('[Karaoke] Grading error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to grade audio',
      },
      500
    );
  }
});

// Grade full karaoke session
app.post('/api/karaoke/grade-session', async (c) => {
  try {
    const { audio_data, lyrics_with_timing, session_id } = await c.req.json();

    if (!audio_data || !lyrics_with_timing || !session_id) {
      return c.json(
        {
          success: false,
          error: 'Missing audio_data, lyrics_with_timing, or session_id',
        },
        400
      );
    }

    const elevenlabsApiKey = c.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      return c.json(
        {
          success: false,
          error: 'ElevenLabs API key not configured',
        },
        500
      );
    }

    console.log('[SessionGrading] Starting hybrid session grading...');
    console.log(`[SessionGrading] Session ID: ${session_id}`);
    console.log(`[SessionGrading] Lyrics: ${lyrics_with_timing.length} lines`);

    // Convert base64 audio to blob
    const audioBuffer = Uint8Array.from(atob(audio_data), (c) =>
      c.charCodeAt(0)
    );
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    console.log(
      `[SessionGrading] Audio size: ${(audioBlob.size / 1024).toFixed(1)}KB`
    );

    // Create lyrics text for forced alignment
    const lyricsText = lyrics_with_timing
      .map((line: any) => line.text)
      .join('\n');

    // Use forced alignment for precise timing
    const startTime = Date.now();
    const forcedAlignment = await performForcedAlignment(
      audioBlob,
      lyricsText,
      elevenlabsApiKey
    );
    const forcedAlignmentTime = Date.now() - startTime;

    console.log(
      `[SessionGrading] Forced alignment completed in ${forcedAlignmentTime}ms: ` +
        `${forcedAlignment.words.length} words aligned`
    );

    // Retrieve stored line results from database
    const getLineResults = async (sessionId: string) => {
      const results = await c.env.DB.prepare(
        `
        SELECT line_index, transcribed_text, score
        FROM line_scores
        WHERE session_id = ?
        ORDER BY line_index
      `
      )
        .bind(sessionId)
        .all();
      return results.results;
    };

    // Use hybrid grading approach
    const gradingResult = await gradeSessionWithHybridApproach(
      session_id,
      forcedAlignment,
      lyrics_with_timing,
      getLineResults
    );

    console.log(
      `[SessionGrading] Hybrid grading completed: ` +
        `Score: ${gradingResult.overallScore}, ` +
        `Lines: ${gradingResult.transcribedLines}/${gradingResult.totalLines}`
    );

    // Update session status and score in database
    try {
      // Get session details
      const sessionDetails = await c.env.DB.prepare(
        `SELECT user_id, track_id, genius_id FROM karaoke_sessions WHERE session_id = ?`
      )
        .bind(session_id)
        .first();

      if (sessionDetails) {
        // Update session as completed with final score
        await c.env.DB.prepare(
          `UPDATE karaoke_sessions 
           SET status = 'completed', 
               completed_at = CURRENT_TIMESTAMP,
               average_score = ?,
               lines_completed = ?
           WHERE session_id = ?`
        )
          .bind(
            gradingResult.overallScore,
            gradingResult.transcribedLines,
            session_id
          )
          .run();

        // Update user's best score if this is better
        const songId = sessionDetails.genius_id || sessionDetails.track_id;
        if (songId && sessionDetails.user_id) {
          await updateUserBestScore(
            c.env.DB,
            sessionDetails.user_id,
            songId,
            gradingResult.overallScore,
            session_id
          );
        }
      }
    } catch (error) {
      console.error('[SessionGrading] Failed to update session/scores:', error);
      // Don't fail the request, just log the error
    }

    return c.json({
      success: true,
      ...gradingResult,
      processing_time: forcedAlignmentTime,
      grading_method: 'hybrid_forced_alignment',
    });
  } catch (error) {
    console.error('[SessionGrading] Error:', error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to grade session',
      },
      500
    );
  }
});

// Get session status
app.get(
  '/api/karaoke/session/:sessionId',
  authMiddleware,
  async (c: AuthContext) => {
    const sessionId = c.req.param('sessionId');

    if (!c.user) {
      return c.json(
        {
          success: false,
          error: 'Authentication required',
        },
        401
      );
    }

    console.log(
      '[Karaoke Session] Getting session status:',
      sessionId,
      'for user:',
      c.user.id
    );

    // Check in-memory session for backward compatibility
    const session = sessions.get(sessionId);

    // Get session data from database
    try {
      const dbSession = await c.env.DB.prepare(
        `
      SELECT * FROM karaoke_sessions 
      WHERE id = ? AND user_id = ?
    `
      )
        .bind(sessionId, c.user.id)
        .first();

      if (!dbSession) {
        console.log('[Karaoke Session] Session not found in database');
        return c.json(
          {
            success: false,
            error: 'Session not found',
          },
          404
        );
      }

      // Get line attempts for this session
      const attempts = await c.env.DB.prepare(
        `
      SELECT id as attempt_id, line_index, line_text as expected_text, transcribed_text, 
             score as overall_score, attempt_number, created_at as attempted_at
      FROM line_scores 
      WHERE session_id = ? 
      ORDER BY line_index, created_at
    `
      )
        .bind(sessionId)
        .all();

      console.log(
        `[Karaoke Session] Found ${attempts.results.length} line attempts`
      );

      return c.json({
        success: true,
        session: {
          // Database session data
          session_id: dbSession.id,
          track_name: dbSession.song_title,
          artist_name: dbSession.song_artist,
          started_at: dbSession.created_at,
          status: dbSession.status,
          // Memory session data (backward compatibility)
          memory_session: session || null,
          // Line attempts from database
          line_attempts: attempts.results,
          database_stored: true,
        },
      });
    } catch (dbError) {
      console.error('[Karaoke Session] Database error:', dbError);

      // Fallback to memory session if database fails
      if (session) {
        return c.json({
          success: true,
          session: {
            ...session,
            database_stored: false,
            fallback_to_memory: true,
          },
        });
      }

      return c.json(
        {
          success: false,
          error: 'Session not found',
        },
        404
      );
    }
  }
);

// Get word analysis for a session (testing endpoint)
app.get(
  '/api/karaoke/words/:sessionId',
  authMiddleware,
  async (c: AuthContext) => {
    const sessionId = c.req.param('sessionId');

    if (!c.user) {
      return c.json(
        {
          success: false,
          error: 'Authentication required',
        },
        401
      );
    }

    console.log(
      '[Karaoke Words] Getting word analysis for session:',
      sessionId
    );

    try {
      // Word extraction is currently disabled - return placeholder response
      console.log(
        '[Karaoke Words] Word extraction feature disabled (schema not deployed)'
      );

      return c.json({
        success: true,
        session_id: sessionId,
        total_words: 0,
        lines_analyzed: 0,
        words_by_line: {},
        database_stored: false,
        message: 'Word extraction feature disabled - schema not deployed',
      });
    } catch (dbError) {
      console.error('[Karaoke Words] Database error:', dbError);
      return c.json(
        {
          success: false,
          error: 'Failed to retrieve word analysis',
        },
        500
      );
    }
  }
);

// Helper functions for mock responses (keeping for fallback)
function generateMockFeedback(
  score: number,
  _text: string,
  attempt: number
): string {
  if (score >= 90) return 'Excellent! Perfect pitch and timing! 🌟';
  if (score >= 70) return 'Great job! Your pronunciation was clear! ⭐';
  if (attempt >= 2) return 'Keep practicing! Focus on the rhythm. ❌';
  return 'Try again! Listen to the melody more carefully. ❌';
}

function generateCharacterResponse(score: number, _text: string): string {
  const responses = {
    excellent: [
      'Wow! You nailed that line perfectly! 🎵✨',
      'Amazing! Your voice sounds beautiful! 🌟',
      "Perfect! You're a natural singer! 🎤",
    ],
    good: [
      "Nice work! You're getting the hang of it! ⭐",
      'Good job! Your timing is improving! 🎵',
      'Well done! Keep up the great energy! 👏',
    ],
    poor: [
      "Don't worry, singing takes practice! Try again! 💪",
      'Listen to the melody and try once more! 🎵',
      "You've got this! Take a deep breath and sing! 😊",
    ],
  };

  const category = score >= 90 ? 'excellent' : score >= 70 ? 'good' : 'poor';
  const options = responses[category];
  return options[Math.floor(Math.random() * options.length)];
}

// Extract and analyze words for vocabulary learning
async function extractAndStoreWords(
  attemptId: string,
  expectedText: string,
  transcribedText: string,
  db: any
): Promise<void> {
  console.log(
    '[Word Extract] Starting word extraction for attempt:',
    attemptId
  );

  // Normalize text for word extraction
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const expectedWords = normalize(expectedText)
    .split(' ')
    .filter((w) => w.length > 1);
  const transcribedWords = normalize(transcribedText)
    .split(' ')
    .filter((w) => w.length > 1);

  console.log('[Word Extract] Expected words:', expectedWords);
  console.log('[Word Extract] Transcribed words:', transcribedWords);

  // Store each expected word with analysis
  for (let position = 0; position < expectedWords.length; position++) {
    const expectedWord = expectedWords[position];

    // Find best match in transcribed words using string similarity
    let bestMatch = null;
    let bestSimilarity = 0;
    let transcribedAs = null;

    for (const transcribedWord of transcribedWords) {
      const similarity = calculateStringSimilarity(
        expectedWord,
        transcribedWord
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = transcribedWord;
        transcribedAs = transcribedWord;
      }
    }

    // Determine if word was likely spoken (similarity threshold)
    const wasLikelySpoken = bestSimilarity > 0.6;

    // Calculate phonetic match
    const phoneticMatch = bestMatch
      ? calculatePhoneticSimilarity(expectedWord, bestMatch) > 0.7
      : false;

    console.log(
      `[Word Extract] Word "${expectedWord}" -> similarity: ${bestSimilarity.toFixed(2)}, spoken: ${wasLikelySpoken}, transcribed as: "${transcribedAs}"`
    );

    try {
      // Store word extraction
      await db
        .prepare(
          `
        INSERT INTO karaoke_word_extractions 
        (attempt_id, expected_word, word_position, was_likely_spoken, 
         similarity_score, phonetic_match, transcribed_as)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          attemptId,
          expectedWord,
          position,
          wasLikelySpoken,
          bestSimilarity,
          phoneticMatch,
          transcribedAs
        )
        .run();

      console.log(
        `[Word Extract] ✅ Stored word extraction for "${expectedWord}"`
      );
    } catch (dbError) {
      console.error(
        `[Word Extract] ❌ Error storing word "${expectedWord}":`,
        dbError
      );
    }
  }

  console.log(
    `[Word Extract] ✅ Completed extraction for ${expectedWords.length} words`
  );
}

// AI Tutor Analysis endpoint
app.post('/api/tutor/analyze', async (c) => {
  console.log('[Tutor] Analysis endpoint called');

  try {
    const { overallScore, grade, songTitle, artistName, lineResults } =
      await c.req.json();

    if (!overallScore || !grade || !songTitle || !artistName || !lineResults) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        400
      );
    }

    // Prepare data for Venice AI
    const incorrectLines = lineResults
      .filter((line: any) => line.score < 80)
      .slice(0, 5); // Limit to top 5 for context

    const tutorRequest: TutorAnalysisRequest = {
      overallScore,
      grade,
      songTitle,
      artistName,
      totalLines: lineResults.length,
      attemptedLines: lineResults.filter((l: any) => l.spoken).length,
      incorrectLines,
    };

    console.log('[Tutor] Generating AI feedback for:', {
      song: `${artistName} - ${songTitle}`,
      score: overallScore,
      grade,
      incorrectCount: incorrectLines.length,
    });

    // Generate feedback using Venice AI
    const feedback = await generateKaraokeFeedback(
      {
        overallScore,
        grade,
        songTitle,
        artistName,
        lineResults: incorrectLines,
        totalLines: lineResults.length,
        performedLines: lineResults.filter((l: any) => l.spoken).length,
      },
      c.env as Env
    );

    return c.json({
      success: true,
      feedback: {
        message: feedback.message || feedback.encouragement,
        focusArea: feedback.improvementAreas?.[0] || 'general pronunciation',
        difficulty: feedback.difficulty,
      },
    });
  } catch (error) {
    console.error('[Tutor] Analysis error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to generate analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// AI Tutor TTS endpoint
app.post('/api/tutor/tts', async (c) => {
  console.log('[Tutor] TTS endpoint called');

  try {
    const {
      text,
      voice = 'Rachel',
      model = 'eleven_turbo_v2.5',
    } = await c.req.json();

    if (!text) {
      return c.json({ success: false, error: 'Missing text' }, 400);
    }

    const elevenlabsApiKey = c.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('[Tutor] Generating TTS:', {
      textLength: text.length,
      voice,
      model,
    });

    // Map voice names to ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      Rachel: '21m00Tcm4TlvDq8ikWAM',
      Domi: 'AZnzlk1XvdvUeBnXmlld',
      Bella: 'EXAVITQu4vr4xnSDxMaL',
      Antoni: 'ErXwobaYiN019PkySvjV',
      Elli: 'MF3mGyEYCl7XYWbV9V6O',
      Josh: 'TxGEqnHWrfWFTfGW9XjX',
      Arnold: 'VR6AewLTigWG4xSOukaG',
      Adam: 'pNInz6obpgDQGcFmaJgB',
      Sam: 'yoZ06aMxZJJ28mfd3POQ',
    };

    const voiceId = voiceMap[voice] || voiceMap['Rachel'];

    console.log('[Tutor] Voice mapping:', {
      requestedVoice: voice,
      mappedVoiceId: voiceId,
      model: model,
    });

    // Generate speech with ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenlabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // Fixed model ID format
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Tutor] ElevenLabs error:', error);
      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }

    console.log('[Tutor] TTS generated successfully');

    // Return the audio stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Tutor] TTS error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to generate TTS',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// AI Tutor Exercise STT endpoint
app.post('/api/tutor/exercise-stt', authMiddleware, async (c) => {
  console.log('[Tutor Exercise] STT endpoint called');

  try {
    const { expected_text, audio_data } = await c.req.json();

    if (!expected_text || !audio_data) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        400
      );
    }

    console.log('[Tutor Exercise] Processing audio:', {
      expected_text_length: expected_text.length,
      audio_data_length: audio_data.length,
    });

    // Get Deepgram API key
    const deepgramApiKey = c.env.DEEPGRAM_API_KEY;
    let transcribedText = '';
    let wordTimings: any[] = [];
    let transcriptionConfidence = 0;

    if (deepgramApiKey && audio_data) {
      try {
        console.log('[Tutor Exercise] Using Deepgram for transcription...');

        // Decode base64 audio data
        const audioBuffer = Uint8Array.from(atob(audio_data), (c) =>
          c.charCodeAt(0)
        ).buffer;

        // Use Deepgram for transcription
        const deepgramResult = await transcribeWithDeepgram(
          new Uint8Array(audioBuffer),
          expected_text,
          deepgramApiKey
        );

        transcribedText = deepgramResult.transcript;
        wordTimings = deepgramResult.words;
        transcriptionConfidence = deepgramResult.confidence;

        console.log(
          `[Tutor Exercise] Deepgram transcript: "${transcribedText}"`
        );
      } catch (error) {
        console.error('[Tutor Exercise] Deepgram error:', error);

        // Fallback to ElevenLabs if available
        const elevenlabsApiKey = c.env.ELEVENLABS_API_KEY;
        if (elevenlabsApiKey) {
          console.log('[Tutor Exercise] Falling back to ElevenLabs...');
          try {
            const audioBuffer = Uint8Array.from(atob(audio_data), (c) =>
              c.charCodeAt(0)
            );
            const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');
            formData.append('model_id', 'scribe_v1');
            formData.append('language_code', 'en');

            const response = await fetch(
              'https://api.elevenlabs.io/v1/speech-to-text',
              {
                method: 'POST',
                headers: {
                  'xi-api-key': elevenlabsApiKey,
                },
                body: formData,
              }
            );

            if (response.ok) {
              const result = (await response.json()) as { text?: string };
              transcribedText = result.text || '';
              console.log(
                `[Tutor Exercise] ElevenLabs transcript: "${transcribedText}"`
              );
            }
          } catch (fallbackError) {
            console.error('[Tutor Exercise] ElevenLabs error:', fallbackError);
          }
        }
      }
    }

    // Calculate score using the same logic as karaoke grading
    const { finalScore, wordScores } = calculateKaraokeScoreWithWords(
      expected_text,
      transcribedText,
      wordTimings,
      1 // First attempt for exercises
    );

    console.log('[Tutor Exercise] Score calculated:', finalScore);

    return c.json({
      success: true,
      transcribed_text: transcribedText,
      score: finalScore,
      confidence: transcriptionConfidence,
      word_timings: wordTimings,
      word_scores: wordScores,
    });
  } catch (error) {
    console.error('[Tutor Exercise] Error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to process audio',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Mount authentication routes
app.route('/auth', authRoutes);

// Mount Farcaster routes
app.route('/', farcasterAuthRoutes);

// Mount popular songs routes
app.route('/', popularSongsRoutes);

// Mount leaderboard routes
app.route('/api', leaderboardRouter);

// Audio proxy endpoint for maid.zone
app.get('/api/audio/proxy/:trackId', async (c) => {
  try {
    const trackId = c.req.param('trackId');

    // Try sc.maid.zone format first (working format)
    const scMaidZoneUrl = `https://sc.maid.zone/${trackId}`;
    console.log('[Audio Proxy] Trying sc.maid.zone:', scMaidZoneUrl);

    let response = await fetch(scMaidZoneUrl);
    if (response.ok) {
      const html = await response.text();

      // Look for the restream audio source
      const audioSrcMatch = html.match(/src="([^"]*\/_\/restream\/[^"]*)"/);
      if (audioSrcMatch) {
        const relativeAudioUrl = audioSrcMatch[1];
        const fullAudioUrl = `https://sc.maid.zone${relativeAudioUrl}`;
        console.log('[Audio Proxy] Found restream URL:', fullAudioUrl);

        // Proxy the audio directly
        const audioResponse = await fetch(fullAudioUrl);
        if (audioResponse.ok) {
          return new Response(audioResponse.body, {
            headers: {
              'Content-Type':
                audioResponse.headers.get('Content-Type') || 'audio/mpeg',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Allow-Headers': 'Range',
              'Cross-Origin-Resource-Policy': 'cross-origin',
              'Cross-Origin-Embedder-Policy': 'unsafe-none',
              'Cache-Control': 'public, max-age=3600',
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }
    }

    // Fallback to original maid.zone format
    const maidZoneUrl = `https://maid.zone/${trackId}`;
    console.log('[Audio Proxy] Fallback to maid.zone:', maidZoneUrl);

    response = await fetch(maidZoneUrl);
    if (!response.ok) {
      return c.json(
        { error: 'Track not found on both sc.maid.zone and maid.zone' },
        404
      );
    }

    const html = await response.text();

    // Extract the audio URL from the page (original logic)
    const audioUrlMatch = html.match(/"url":"([^"]*\.mp3[^"]*)"/);
    if (!audioUrlMatch) {
      return c.json({ error: 'Audio URL not found in page' }, 404);
    }

    const audioUrl = audioUrlMatch[1].replace(/\\/g, '');
    console.log('[Audio Proxy] Found audio URL:', audioUrl);

    // Proxy the audio with CORS headers
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return c.json({ error: 'Failed to fetch audio' }, 500);
    }

    // Return the audio with proper CORS headers
    return new Response(audioResponse.body, {
      headers: {
        'Content-Type':
          audioResponse.headers.get('Content-Type') || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Audio Proxy] Error:', error);
    return c.json({ error: 'Failed to proxy audio' }, 500);
  }
});

export default app;
