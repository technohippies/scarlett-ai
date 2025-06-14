import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { SongService } from '../services/song.service';
import { validateQuery } from '../middleware/validation.middleware';
import { paginationSchema } from '../utils/validation';

const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    validatedQuery?: Record<string, unknown>;
  };
}>();

// GET /api/songs/popular - Get popular songs
app.get('/popular', validateQuery(paginationSchema.extend({
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})), async (c) => {
  const query = c.get('validatedQuery') as {
    page: number;
    limit: number;
    difficulty?: string;
  };

  // Get user language from Accept-Language header
  const acceptLanguage = c.req.header('Accept-Language');
  const userLanguage = acceptLanguage?.split(',')[0]?.split(';')[0] || 'en';
  
  console.log('[Songs Route] Popular songs request:', {
    acceptLanguage,
    parsedLanguage: userLanguage,
    query
  });
  
  const songService = new SongService(c.env);
  const result = await songService.getPopularSongs(
    query.page,
    query.limit,
    query.difficulty,
    userLanguage
  );

  return c.json(result);
});

// GET /api/songs/trending - Get trending songs
app.get('/trending', validateQuery(z.object({
  timeframe: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
  limit: z.coerce.number().min(1).max(50).default(20),
})), async (c) => {
  const query = c.get('validatedQuery') as {
    timeframe: '24h' | '7d' | '30d' | 'all';
    limit: number;
  };

  const songService = new SongService(c.env);
  const songs = await songService.getTrendingSongs(query.timeframe, query.limit);

  return c.json({
    success: true,
    timeframe: query.timeframe,
    songs,
    total: songs.length,
  });
});

// GET /api/songs/:songId - Get song details
app.get('/:songId', async (c) => {
  const songId = c.req.param('songId');
  const songService = new SongService(c.env);

  const song = await songService.getSongById(songId);
  if (!song) {
    return c.json(
      {
        success: false,
        error: 'Song not found',
      },
      404
    );
  }

  return c.json({
    success: true,
    song,
  });
});

// GET /api/songs/:songId/leaderboard - Get song leaderboard
app.get('/:songId/leaderboard', validateQuery(z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
})), async (c) => {
  const songId = c.req.param('songId');
  const { limit } = c.get('validatedQuery') as { limit: number };

  const songService = new SongService(c.env);
  
  try {
    const result = await songService.getSongLeaderboard(songId, limit);
    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }
    throw error;
  }
});

export default app;