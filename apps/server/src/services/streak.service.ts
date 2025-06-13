import type { D1Database } from '@cloudflare/workers-types';

export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
  completedToday: boolean;
}

export interface UserRanking {
  userId: string;
  songId: string;
  position: number;
  score: number;
  totalPlayers: number;
}

export class StreakService {
  constructor(private db: D1Database) {}

  /**
   * Get user's current streak information
   */
  async getUserStreak(userId: string): Promise<UserStreak> {
    try {
      // Get user streak data
      const result = await this.db.prepare(`
        SELECT 
          user_id,
          current_streak,
          longest_streak,
          last_completion_date,
          DATE(last_completion_date) = DATE('now', 'localtime') as completed_today
        FROM user_streaks
        WHERE user_id = ?
      `).bind(userId).first();

      if (!result) {
        // Try to create new streak record
        try {
          await this.db.prepare(`
            INSERT INTO user_streaks (user_id, current_streak, longest_streak)
            VALUES (?, 0, 0)
          `).bind(userId).run();
        } catch (insertError) {
          // Table might not exist, return default
          console.log('Could not create user streak record:', insertError);
        }

        return {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
          completedToday: false
        };
      }

      return {
        userId: result.user_id as string,
        currentStreak: result.current_streak as number,
        longestStreak: result.longest_streak as number,
        lastCompletionDate: result.last_completion_date as string | null,
        completedToday: Boolean(result.completed_today)
      };
    } catch (error) {
      console.error('Error getting user streak:', error);
      // Return default values if table doesn't exist
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
        completedToday: false
      };
    }
  }

  /**
   * Update user's streak when they complete a song
   */
  async updateStreak(userId: string, timezone: string = 'UTC'): Promise<UserStreak> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get current streak info
    const current = await this.getUserStreak(userId);
    
    // If already completed today, return current streak
    if (current.completedToday) {
      return current;
    }

    // Calculate if streak continues or resets
    let newStreak = 1;
    if (current.lastCompletionDate) {
      const lastDate = new Date(current.lastCompletionDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - continue streak
        newStreak = current.currentStreak + 1;
      } else if (daysDiff === 2) {
        // Allow one skip day (grace period)
        newStreak = current.currentStreak + 1;
      }
      // Otherwise reset to 1
    }

    const newLongest = Math.max(newStreak, current.longestStreak);

    // Update streak
    await this.db.prepare(`
      UPDATE user_streaks 
      SET 
        current_streak = ?,
        longest_streak = ?,
        last_completion_date = ?,
        timezone = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(newStreak, newLongest, today, timezone, userId).run();

    // Record daily completion
    await this.db.prepare(`
      INSERT INTO user_daily_completions (user_id, completion_date)
      VALUES (?, ?)
      ON CONFLICT (user_id, completion_date) 
      DO UPDATE SET songs_completed = songs_completed + 1
    `).bind(userId, today).run();

    return {
      userId,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastCompletionDate: today,
      completedToday: true
    };
  }

  /**
   * Get user's rankings for all songs
   */
  async getUserRankings(userId: string): Promise<UserRanking[]> {
    try {
      const results = await this.db.prepare(`
        SELECT 
          sl.song_catalog_id as song_id,
          sl.position,
          sl.score,
          COUNT(DISTINCT sl2.user_id) as total_players
        FROM song_leaderboards sl
        JOIN song_leaderboards sl2 ON sl.song_catalog_id = sl2.song_catalog_id
        WHERE sl.user_id = ?
        GROUP BY sl.song_catalog_id, sl.position, sl.score
        ORDER BY sl.position ASC
      `).bind(userId).all();

      return results.results.map(row => ({
        userId,
        songId: row.song_id as string,
        position: row.position as number,
        score: row.score as number,
        totalPlayers: row.total_players as number
      }));
    } catch (error) {
      console.error('Error getting user rankings:', error);
      // Return empty array if view doesn't exist
      return [];
    }
  }

  /**
   * Check if user has any #1 positions
   */
  async hasTopPosition(userId: string): Promise<boolean> {
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(*) as count
        FROM song_leaderboards
        WHERE user_id = ? AND position = 1
      `).bind(userId).first();

      return (result?.count as number) > 0;
    } catch (error) {
      console.error('Error checking top position:', error);
      // Return false if view doesn't exist
      return false;
    }
  }

  /**
   * Get leaderboard for a specific song
   */
  async getSongLeaderboard(songId: string, limit: number = 10): Promise<any[]> {
    const results = await this.db.prepare(`
      SELECT 
        p.user_id,
        p.score,
        p.created_at,
        RANK() OVER (ORDER BY p.score DESC, p.created_at ASC) as position
      FROM performances p
      WHERE p.song_catalog_id = ?
      ORDER BY p.score DESC, p.created_at ASC
      LIMIT ?
    `).bind(songId, limit).all();

    return results.results;
  }

  /**
   * Update rankings after a performance
   */
  async updateRankings(userId: string, songId: string, score: number): Promise<number> {
    // Get current best score for this user/song
    const currentBest = await this.db.prepare(`
      SELECT MAX(score) as best_score
      FROM performances
      WHERE user_id = ? AND song_catalog_id = ?
    `).bind(userId, songId).first();

    const previousBest = currentBest?.best_score as number || 0;

    // If this is a new best score, update the is_best_score flag
    if (score > previousBest) {
      // Remove old best score flag
      await this.db.prepare(`
        UPDATE performances
        SET is_best_score = FALSE
        WHERE user_id = ? AND song_catalog_id = ?
      `).bind(userId, songId).run();

      // Set new best score flag (will be set when performance is saved)
      return 1; // Placeholder - actual position will be calculated from view
    }

    // Get current position
    const position = await this.db.prepare(`
      SELECT position
      FROM song_leaderboards
      WHERE user_id = ? AND song_catalog_id = ?
      ORDER BY score DESC
      LIMIT 1
    `).bind(userId, songId).first();

    return position?.position as number || 999;
  }
}