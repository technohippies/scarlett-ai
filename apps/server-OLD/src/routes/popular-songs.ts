import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../auth';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for Farcaster mini app
app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:3002',
      'https://farcaster.xyz',
      'https://warpcast.com',
    ],
    credentials: true,
  })
);

// Get popular songs from catalog
app.get('/api/songs/popular', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');

    // Query popular songs from catalog, ordered by multiple popularity metrics
    const popularSongs = await c.env.DB.prepare(
      `
      SELECT 
        id,
        track_id,
        title,
        artist,
        album,
        duration_ms,
        difficulty,
        artwork_url,
        soundcloud_url,
        total_attempts,
        total_completions,
        success_rate,
        average_score,
        unique_users_attempted,
        unique_users_completed,
        last_played_at,
        is_featured
      FROM song_catalog 
      WHERE is_hidden = false
      ORDER BY 
        is_featured DESC,
        (total_attempts * 0.4 + unique_users_attempted * 0.6) DESC,
        success_rate DESC,
        last_played_at DESC
      LIMIT ? OFFSET ?
    `
    )
      .bind(limit, offset)
      .all();

    // If no songs in catalog, return some mock popular songs for testing
    if (!popularSongs.results || popularSongs.results.length === 0) {
      return c.json({
        songs: [
          {
            id: 'mock-1',
            track_id: 'edsheeran/perfect',
            title: 'Perfect',
            artist: 'Ed Sheeran',
            album: '÷ (Divide)',
            duration_ms: 263000,
            difficulty: 'beginner',
            artwork_url: '/images/perfect-artwork.jpg',
            soundcloud_url: 'https://maid.zone/edsheeran/perfect',
            total_attempts: 156,
            total_completions: 89,
            success_rate: 0.57,
            average_score: 78.5,
            unique_users_attempted: 45,
            unique_users_completed: 28,
            is_featured: true,
          },
          {
            id: 'mock-2',
            track_id: 'edsheeran/shape-of-you',
            title: 'Shape of You',
            artist: 'Ed Sheeran',
            album: '÷ (Divide)',
            duration_ms: 234000,
            difficulty: 'intermediate',
            artwork_url: '/images/shape-artwork.jpg',
            soundcloud_url: 'https://maid.zone/edsheeran/shape-of-you',
            total_attempts: 234,
            total_completions: 156,
            success_rate: 0.67,
            average_score: 82.1,
            unique_users_attempted: 78,
            unique_users_completed: 52,
            is_featured: false,
          },
          {
            id: 'mock-3',
            track_id: 'theweeknd/blinding-lights',
            title: 'Blinding Lights',
            artist: 'The Weeknd',
            album: 'After Hours',
            duration_ms: 200000,
            difficulty: 'intermediate',
            artwork_url: '/images/blinding-artwork.jpg',
            soundcloud_url: 'https://maid.zone/theweeknd/blinding-lights',
            total_attempts: 198,
            total_completions: 134,
            success_rate: 0.68,
            average_score: 75.8,
            unique_users_attempted: 62,
            unique_users_completed: 41,
            is_featured: false,
          },
        ],
        pagination: {
          total: 3,
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    return c.json({
      songs: popularSongs.results,
      pagination: {
        total: popularSongs.results.length,
        limit,
        offset,
        hasMore: popularSongs.results.length === limit,
      },
    });
  } catch (error) {
    console.error('Error fetching popular songs:', error);
    return c.json({ error: 'Failed to fetch popular songs' }, 500);
  }
});

// Get song details with lyrics
app.get('/api/songs/:songId', async (c) => {
  try {
    const songId = c.req.param('songId');

    // Get song from catalog
    const song = await c.env.DB.prepare(
      `
      SELECT * FROM song_catalog WHERE id = ? OR track_id = ?
    `
    )
      .bind(songId, songId)
      .first();

    if (!song) {
      return c.json({ error: 'Song not found' }, 404);
    }

    console.log(
      `[Song Details] Fetching lyrics for: ${song.artist} - ${song.title} (${song.track_id})`
    );

    // Use the existing karaoke API to get real lyrics
    try {
      // Make internal request to the karaoke endpoint
      const karaokeUrl = `http://localhost:8787/api/karaoke/${song.track_id}?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`;
      console.log(`[Song Details] Requesting karaoke data from: ${karaokeUrl}`);

      const karaokeResponse = await fetch(karaokeUrl);

      if (karaokeResponse.ok) {
        const karaokeData = await karaokeResponse.json();

        if (karaokeData.has_karaoke && karaokeData.lyrics?.lines) {
          console.log(
            `[Song Details] Found ${karaokeData.lyrics.lines.length} lyric lines`
          );

          // Convert karaoke format to frontend format
          const formattedLyrics = karaokeData.lyrics.lines.map(
            (line: any, index: number) => ({
              id: String(index + 1),
              text: line.text,
              startTime: line.startTime * 1000, // Convert to milliseconds
              endTime: line.endTime * 1000,
              wordTimings: [], // Could be populated if needed
            })
          );

          return c.json({
            song,
            lyrics: formattedLyrics,
            audioUrl:
              song.soundcloud_url || `https://sc.maid.zone/${song.track_id}`,
            hasLyrics: true,
            lyricsSource: karaokeData.lyrics.source,
          });
        }
      }

      console.log(`[Song Details] No karaoke data found, using fallback`);
    } catch (karaokeError) {
      console.error(
        '[Song Details] Error fetching karaoke data:',
        karaokeError
      );
    }

    // Fallback to indicating no lyrics available
    return c.json({
      song,
      lyrics: [],
      audioUrl: song.soundcloud_url || `https://sc.maid.zone/${song.track_id}`,
      hasLyrics: false,
      message: 'No synchronized lyrics available for this song',
    });
  } catch (error) {
    console.error('Error fetching song details:', error);
    return c.json({ error: 'Failed to fetch song details' }, 500);
  }
});

export default app;
