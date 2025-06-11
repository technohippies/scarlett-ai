import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { createPracticeService } from '../services/practice.service';
import { authMiddleware } from '../middleware/auth.middleware';

// Validation schemas
const getExercisesSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sessionId: z.string().optional()
});

const reviewExerciseSchema = z.object({
  exerciseId: z.string(),
  audioBase64: z.string(),
  transcription: z.string().optional()
});

const getPracticeStatsSchema = z.object({
  days: z.string().regex(/^\d+$/).transform(Number).optional()
});

export const practiceRoutes = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
// TODO: Re-enable auth when authentication is implemented
// practiceRoutes.use('*', authMiddleware);

/**
 * Get due practice exercises
 */
practiceRoutes.get(
  '/exercises',
  zValidator('query', getExercisesSchema),
  async (c) => {
    const { limit = 10, sessionId } = c.req.valid('query');
    // For testing - in production this would come from auth
    const userId = c.get('userId') || 'test-user-1';
    
    try {
      const practiceService = createPracticeService(c.env.DB, c.env);
      const exercises = await practiceService.getDueExercises(userId, limit, sessionId);
      
      return c.json({
        success: true,
        data: {
          exercises,
          count: exercises.length
        }
      });
    } catch (error) {
      console.error('[Practice] Failed to get exercises:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to retrieve practice exercises' 
      }, 500);
    }
  }
);

/**
 * Review a practice exercise
 */
practiceRoutes.post(
  '/review',
  zValidator('json', reviewExerciseSchema),
  async (c) => {
    const { exerciseId, audioBase64, transcription } = c.req.valid('json');
    const userId = c.get('userId') || 'test-user-1';
    
    try {
      // Convert base64 to audio blob
      const audioBuffer = Uint8Array.from(atob(audioBase64), char => char.charCodeAt(0));
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      
      // Get transcription if not provided
      let userTranscription = transcription;
      if (!userTranscription) {
        // Use STT service to get transcription
        const formData = new FormData();
        formData.append('audio', audioBlob);
        
        const sttResponse = await fetch(`${c.req.url.origin}/api/speech-to-text/transcribe`, {
          method: 'POST',
          headers: {
            'Authorization': c.req.header('Authorization') || ''
          },
          body: formData
        });
        
        if (sttResponse.ok) {
          const sttData = await sttResponse.json();
          userTranscription = sttData.transcription;
        }
      }
      
      // TODO: Get individual word scores from the exercise
      // For now, we'll use a simple overall score
      const overallScore = 85; // Placeholder
      
      const practiceService = createPracticeService(c.env.DB, c.env);
      const result = await practiceService.reviewExercise(
        exerciseId,
        userId,
        userTranscription || '',
        [{ cardId: 'placeholder', score: overallScore }] // TODO: Get real card scores
      );
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[Practice] Failed to review exercise:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to process review' 
      }, 500);
    }
  }
);

/**
 * Get practice statistics
 */
practiceRoutes.get(
  '/stats',
  zValidator('query', getPracticeStatsSchema),
  async (c) => {
    const { days = 30 } = c.req.valid('query');
    const userId = c.get('userId') || 'test-user-1';
    
    try {
      const stats = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT card_id) as cards_reviewed,
          COUNT(*) as total_reviews,
          AVG(score) as average_score,
          MAX(score) as best_score,
          COUNT(CASE WHEN rating = 'Easy' THEN 1 END) as easy_count,
          COUNT(CASE WHEN rating = 'Good' THEN 1 END) as good_count,
          COUNT(CASE WHEN rating = 'Hard' THEN 1 END) as hard_count,
          COUNT(CASE WHEN rating = 'Again' THEN 1 END) as again_count
        FROM card_reviews
        WHERE user_id = ? 
          AND reviewed_at >= datetime('now', '-' || ? || ' days')
      `).bind(userId, days).first();
      
      const upcomingCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM practice_cards
        WHERE user_id = ? AND due <= datetime('now', '+7 days')
      `).bind(userId).first();
      
      const improvingWords = await c.env.DB.prepare(`
        SELECT 
          pc.target_text,
          pc.average_score,
          pc.review_count,
          MIN(cr.score) as first_score,
          MAX(cr.score) as latest_score
        FROM practice_cards pc
        JOIN card_reviews cr ON pc.id = cr.card_id
        WHERE pc.user_id = ?
        GROUP BY pc.id
        HAVING latest_score > first_score + 10
        ORDER BY (latest_score - first_score) DESC
        LIMIT 5
      `).bind(userId).all();
      
      return c.json({
        success: true,
        data: {
          summary: stats,
          upcomingReviews: upcomingCount?.count || 0,
          improvingWords: improvingWords.results || [],
          period: `${days} days`
        }
      });
    } catch (error) {
      console.error('[Practice] Failed to get stats:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to retrieve statistics' 
      }, 500);
    }
  }
);

/**
 * Get practice history
 */
practiceRoutes.get('/history', async (c) => {
  const userId = c.get('userId') || 'test-user-1';
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;
  
  try {
    const history = await c.env.DB.prepare(`
      SELECT 
        cr.id,
        cr.score,
        cr.rating,
        cr.reviewed_at,
        pc.target_text,
        pc.state,
        cc.full_line,
        sc.title as song_title,
        sc.artist as song_artist
      FROM card_reviews cr
      JOIN practice_cards pc ON cr.card_id = pc.id
      JOIN card_contexts cc ON pc.id = cc.card_id
      JOIN song_catalog sc ON cc.song_id = sc.id
      WHERE cr.user_id = ?
      ORDER BY cr.reviewed_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM card_reviews WHERE user_id = ?'
    ).bind(userId).first();
    
    return c.json({
      success: true,
      data: {
        reviews: history.results || [],
        pagination: {
          total: total?.count || 0,
          limit,
          offset,
          hasMore: (total?.count || 0) > offset + limit
        }
      }
    });
  } catch (error) {
    console.error('[Practice] Failed to get history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to retrieve practice history' 
      }, 500);
  }
});

/**
 * Reset a specific card (admin/debug endpoint)
 */
practiceRoutes.post('/cards/:cardId/reset', async (c) => {
  const userId = c.get('userId') || 'test-user-1';
  const cardId = c.req.param('cardId');
  
  try {
    // Verify card belongs to user
    const card = await c.env.DB.prepare(
      'SELECT id FROM practice_cards WHERE id = ? AND user_id = ?'
    ).bind(cardId, userId).first();
    
    if (!card) {
      return c.json({ 
        success: false, 
        error: 'Card not found' 
      }, 404);
    }
    
    // Reset to new card state
    await c.env.DB.prepare(`
      UPDATE practice_cards SET
        due = datetime('now'),
        stability = 0,
        difficulty = 0,
        elapsed_days = 0,
        scheduled_days = 0,
        reps = 0,
        lapses = 0,
        state = 'New',
        last_review = NULL
      WHERE id = ?
    `).bind(cardId).run();
    
    return c.json({
      success: true,
      message: 'Card reset successfully'
    });
  } catch (error) {
    console.error('[Practice] Failed to reset card:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to reset card' 
    }, 500);
  }
});