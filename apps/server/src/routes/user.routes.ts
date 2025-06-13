import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { StreakService } from '../services/streak.service';

const userRoutes = new Hono<{ Bindings: Env }>();

// Enable CORS
userRoutes.use('/*', cors());

// Get user streak
userRoutes.get('/:userId/streak', async (c) => {
  try {
    const userId = c.req.param('userId');
    const streakService = new StreakService(c.env.DB);
    
    // getUserStreak already handles errors and returns default values
    const streak = await streakService.getUserStreak(userId);
    
    return c.json({
      success: true,
      data: streak
    });
  } catch (error) {
    console.error('Error fetching user streak:', error);
    // Return default values instead of 500 error for new users
    return c.json({
      success: true,
      data: {
        userId: c.req.param('userId'),
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
        completedToday: false
      }
    });
  }
});

// Update user streak (called after song completion)
userRoutes.post('/:userId/streak', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { timezone } = await c.req.json();
    
    const streakService = new StreakService(c.env.DB);
    const updatedStreak = await streakService.updateStreak(userId, timezone);
    
    return c.json({
      success: true,
      data: updatedStreak
    });
  } catch (error) {
    console.error('Error updating streak:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update streak' 
    }, 500);
  }
});

// Get user rankings
userRoutes.get('/:userId/rankings', async (c) => {
  try {
    const userId = c.req.param('userId');
    const streakService = new StreakService(c.env.DB);
    
    // These methods already handle errors and return default values
    const rankings = await streakService.getUserRankings(userId);
    const hasTopPosition = await streakService.hasTopPosition(userId);
    
    return c.json({
      success: true,
      data: {
        rankings,
        hasTopPosition
      }
    });
  } catch (error) {
    console.error('Error fetching user rankings:', error);
    // Return default values instead of 500 error for new users
    return c.json({
      success: true,
      data: {
        rankings: [],
        hasTopPosition: false
      }
    });
  }
});

// Get leaderboard for a specific song
userRoutes.get('/leaderboard/:songId', async (c) => {
  try {
    const songId = c.req.param('songId');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const streakService = new StreakService(c.env.DB);
    const leaderboard = await streakService.getSongLeaderboard(songId, limit);
    
    return c.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch leaderboard' 
    }, 500);
  }
});

export { userRoutes };