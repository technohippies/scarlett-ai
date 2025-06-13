import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { StreakService } from '../services/streak.service';
import { nanoid } from 'nanoid';

const performanceRoutes = new Hono<{ Bindings: Env }>();

// Enable CORS
performanceRoutes.use('/*', cors());

// Schema for saving performance
const savePerformanceSchema = z.object({
  userId: z.string(),
  songCatalogId: z.string(),
  score: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100).optional(),
  sessionDurationMs: z.number().optional(),
  linesCompleted: z.number().optional(),
  totalLines: z.number().optional(),
  timezone: z.string().optional()
});

// Save a performance and update streak
performanceRoutes.post('/save', zValidator('json', savePerformanceSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const performanceId = nanoid();
    
    // Check if this is a complete performance (score > 70% means they finished the song well)
    const isComplete = data.score >= 70;
    
    // Save performance
    await c.env.DB.prepare(`
      INSERT INTO performances (
        id,
        user_id,
        song_catalog_id,
        score,
        accuracy,
        session_duration_ms,
        lines_completed,
        total_lines
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      performanceId,
      data.userId,
      data.songCatalogId,
      data.score,
      data.accuracy || 0,
      data.sessionDurationMs || 0,
      data.linesCompleted || 0,
      data.totalLines || 0
    ).run();
    
    // Update streak if performance is complete
    let streakData = null;
    if (isComplete) {
      const streakService = new StreakService(c.env.DB);
      streakData = await streakService.updateStreak(data.userId, data.timezone || 'UTC');
    }
    
    // Update rankings
    const streakService = new StreakService(c.env.DB);
    const position = await streakService.updateRankings(
      data.userId, 
      data.songCatalogId, 
      data.score
    );
    
    // Check if user is now #1
    const hasTopPosition = await streakService.hasTopPosition(data.userId);
    
    // Update song statistics
    await c.env.DB.prepare(`
      UPDATE song_catalog 
      SET 
        total_attempts = total_attempts + 1,
        total_completions = total_completions + ?,
        last_played_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(isComplete ? 1 : 0, data.songCatalogId).run();
    
    return c.json({
      success: true,
      data: {
        performanceId,
        position,
        isNewBest: position === 1,
        hasTopPosition,
        streak: streakData
      }
    });
  } catch (error) {
    console.error('Error saving performance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to save performance' 
    }, 500);
  }
});

// Get performance history for a user
performanceRoutes.get('/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const performances = await c.env.DB.prepare(`
      SELECT 
        p.*,
        sc.title as song_title,
        sc.artist as song_artist,
        sl.position as current_rank
      FROM performances p
      JOIN song_catalog sc ON p.song_catalog_id = sc.id
      LEFT JOIN song_leaderboards sl ON p.user_id = sl.user_id AND p.song_catalog_id = sl.song_catalog_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM performances WHERE user_id = ?'
    ).bind(userId).first();
    
    return c.json({
      success: true,
      data: {
        performances: performances.results || [],
        pagination: {
          total: total?.count || 0,
          limit,
          offset,
          hasMore: (total?.count || 0) > offset + limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching performance history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch performance history' 
    }, 500);
  }
});

export { performanceRoutes };