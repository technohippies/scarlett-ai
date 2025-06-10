import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware, type Env, type AuthContext } from '../auth';

const leaderboardRouter = new Hono<{ Bindings: Env }>();

// Get leaderboard for a specific song
leaderboardRouter.get('/songs/:songId/leaderboard', async (c) => {
  const songId = c.req.param('songId');
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // Get current user ID from auth if available
    const authHeader = c.req.header('Authorization');
    let currentUserId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Decode JWT to get user ID (simple decode, server validates)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          currentUserId = payload.userId || null;
        }
      } catch (e) {
        console.error('Failed to decode JWT for user identification:', e);
      }
    }

    // Fetch top scores for this song
    const query = `
      SELECT 
        ubs.user_id,
        COALESCE(u.display_name, u.wallet_address, u.email) as user_display,
        ubs.best_score as score,
        ubs.achieved_at,
        RANK() OVER (ORDER BY ubs.best_score DESC, ubs.achieved_at ASC) as rank
      FROM user_best_scores ubs
      JOIN users u ON ubs.user_id = u.id
      WHERE ubs.song_id = ?
        AND ubs.best_score > 0
        AND u.is_active = 1
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    const results = await c.env.DB.prepare(query)
      .bind(songId, limit, offset)
      .all();

    // Format the leaderboard entries
    const entries = results.results.map((row: any) => ({
      rank: row.rank,
      userDisplay: truncateAddress(row.user_display),
      score: row.score,
      isCurrentUser: currentUserId ? row.user_id === currentUserId : false,
      achievedAt: row.achieved_at,
    }));

    // If user is authenticated but not in top list, get their rank
    let userRank = null;
    if (currentUserId && !entries.some(e => e.isCurrentUser)) {
      const userRankQuery = `
        SELECT 
          best_score,
          (SELECT COUNT(*) + 1 FROM user_best_scores 
           WHERE song_id = ? AND best_score > ubs.best_score) as rank
        FROM user_best_scores ubs
        WHERE user_id = ? AND song_id = ?
      `;
      
      const userResult = await c.env.DB.prepare(userRankQuery)
        .bind(songId, currentUserId, songId)
        .first();
        
      if (userResult) {
        userRank = {
          rank: userResult.rank,
          score: userResult.best_score,
        };
      }
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM user_best_scores 
      WHERE song_id = ? AND best_score > 0
    `;
    
    const countResult = await c.env.DB.prepare(countQuery)
      .bind(songId)
      .first();

    return c.json({
      entries,
      userRank,
      pagination: {
        limit,
        offset,
        total: countResult?.total || 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return c.json({ error: 'Failed to fetch leaderboard' }, 500);
  }
});

// Get user's best score for a specific song
leaderboardRouter.get('/users/me/songs/:songId/best-score', authMiddleware, async (c: AuthContext) => {
  if (!c.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const songId = c.req.param('songId');

  try {
    const query = `
      SELECT 
        best_score,
        best_session_id,
        achieved_at,
        total_attempts,
        average_score,
        last_played_at
      FROM user_best_scores
      WHERE user_id = ? AND song_id = ?
    `;

    const result = await c.env.DB.prepare(query)
      .bind(c.user.id, songId)
      .first();

    if (!result) {
      return c.json({ bestScore: null, hasPlayed: false });
    }

    return c.json({
      bestScore: result.best_score,
      bestSessionId: result.best_session_id,
      achievedAt: result.achieved_at,
      totalAttempts: result.total_attempts,
      averageScore: result.average_score,
      lastPlayedAt: result.last_played_at,
      hasPlayed: true,
    });
  } catch (error) {
    console.error('Failed to fetch user best score:', error);
    return c.json({ error: 'Failed to fetch best score' }, 500);
  }
});

// Helper function to truncate wallet addresses
function truncateAddress(address: string): string {
  if (!address) return 'Anonymous';
  
  // Don't truncate ENS names or short usernames
  if (address.includes('.eth') || address.length <= 12) {
    return address;
  }
  
  // Truncate long addresses (likely wallet addresses)
  if (address.startsWith('0x') && address.length > 20) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  return address;
}

export { leaderboardRouter };