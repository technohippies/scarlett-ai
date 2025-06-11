import { nanoid } from 'nanoid';
import type { Env, KaraokeSession, LineScore } from '../types';
import { NotFoundError } from '../types';

export class SessionService {
  constructor(private env: Env) {}

  async createSession(
    userId: string | undefined,
    trackId: string,
    songData: {
      title: string;
      artist: string;
      geniusId?: string;
      duration?: number;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      catalogId?: string;
    }
  ): Promise<KaraokeSession> {
    const sessionId = nanoid();

    await this.env.DB.prepare(
      `INSERT INTO karaoke_sessions (
        id, user_id, track_id, song_title, song_artist, song_genius_id,
        song_duration, song_difficulty, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`
    )
      .bind(
        sessionId,
        userId || null,
        trackId,
        songData.title,
        songData.artist,
        songData.geniusId || null,
        songData.duration || null,
        songData.difficulty || null
      )
      .run();

    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  async getSession(
    sessionId: string,
    userId?: string
  ): Promise<KaraokeSession | null> {
    let query = `
      SELECT 
        id, user_id as userId, track_id as trackId,
        song_title as songTitle, song_artist as songArtist,
        song_genius_id as songGeniusId, song_duration as songDuration,
        song_difficulty as songDifficulty, current_line as currentLine,
        status, total_score as totalScore, lines_completed as linesCompleted,
        lines_total as linesTotal, accuracy_percentage as accuracyPercentage,
        created_at as createdAt, started_at as startedAt,
        completed_at as completedAt, duration_seconds as durationSeconds,
        credits_used as creditsUsed
      FROM karaoke_sessions 
      WHERE id = ?`;

    const params = [sessionId];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const result = await this.env.DB.prepare(query)
      .bind(...params)
      .first();

    return result as KaraokeSession | null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'paused' | 'completed' | 'abandoned'
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const params: (string | number)[] = [status];

    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    await this.env.DB.prepare(
      `UPDATE karaoke_sessions SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params, sessionId)
      .run();
  }

  async recordLineScore(
    sessionId: string,
    lineScore: Partial<LineScore> & { lineIndex: number; expectedText: string; score: number }
  ): Promise<void> {
    const attemptId = nanoid();

    await this.env.DB.prepare(
      `INSERT INTO line_scores (
        id, session_id, line_index, line_text, score, transcribed_text,
        attempt_number, processing_time_ms, feedback_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        attemptId,
        sessionId,
        lineScore.lineIndex,
        lineScore.expectedText,
        lineScore.score,
        lineScore.transcribedText || '',
        lineScore.attemptNumber || 1,
        0, // processing time not tracked here
        lineScore.feedback || null
      )
      .run();

    // Update session progress
    await this.updateSessionProgress(sessionId, lineScore.lineIndex);
  }

  private async updateSessionProgress(
    sessionId: string,
    lineIndex: number
  ): Promise<void> {
    await this.env.DB.prepare(
      `UPDATE karaoke_sessions 
       SET current_line = ?, 
           lines_completed = (
             SELECT COUNT(DISTINCT line_index) 
             FROM line_scores 
             WHERE session_id = ?
           )
       WHERE id = ?`
    )
      .bind(lineIndex, sessionId, sessionId)
      .run();
  }

  async completeSession(
    sessionId: string,
    totalLines?: number | null,
    overallScore?: number
  ): Promise<{
    sessionId: string;
    finalScore: number;
    totalLines: number;
    perfectLines: number;
    goodLines: number;
    needsWorkLines: number;
    accuracy: number;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    // Calculate session stats if not provided
    let finalScore = overallScore || 0;
    let linesTotal = totalLines || 0;
    
    if (!totalLines || !overallScore) {
      // Get line scores to calculate stats
      const lineScores = await this.getSessionLineScores(sessionId);
      linesTotal = lineScores.length;
      
      if (lineScores.length > 0) {
        finalScore = Math.round(
          lineScores.reduce((sum, line) => sum + line.score, 0) / lineScores.length
        );
      }
    }
    
    // Calculate line categories
    const lineScores = await this.getSessionLineScores(sessionId);
    const perfectLines = lineScores.filter(l => l.score >= 95).length;
    const goodLines = lineScores.filter(l => l.score >= 80 && l.score < 95).length;
    const needsWorkLines = lineScores.filter(l => l.score < 80).length;

    // Calculate session duration
    const durationSeconds = session.startedAt
      ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    await this.env.DB.prepare(
      `UPDATE karaoke_sessions 
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           total_score = ?,
           lines_total = ?,
           accuracy_percentage = ?,
           duration_seconds = ?
       WHERE id = ?`
    )
      .bind(finalScore, linesTotal, finalScore, durationSeconds, sessionId)
      .run();

    // Update user's best score if applicable
    if (session.userId && session.songGeniusId) {
      await this.updateUserBestScore(
        session.userId,
        session.songGeniusId,
        finalScore,
        sessionId
      );
    }
    
    return {
      sessionId,
      finalScore,
      totalLines: linesTotal,
      perfectLines,
      goodLines,
      needsWorkLines,
      accuracy: finalScore
    };
  }

  private async updateUserBestScore(
    userId: string,
    songId: string,
    newScore: number,
    sessionId: string
  ): Promise<void> {
    const existing = await this.env.DB.prepare(
      `SELECT id, best_score FROM user_best_scores 
       WHERE user_id = ? AND song_id = ?`
    )
      .bind(userId, songId)
      .first();

    if (!existing) {
      // First time playing this song
      await this.env.DB.prepare(
        `INSERT INTO user_best_scores (
          id, user_id, song_id, best_score, best_session_id,
          achieved_at, total_attempts, average_score, last_played_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, CURRENT_TIMESTAMP)`
      )
        .bind(nanoid(), userId, songId, newScore, sessionId, newScore)
        .run();
    } else if (newScore > (existing.best_score as number)) {
      // New best score
      await this.env.DB.prepare(
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
    } else {
      // Not a new best, just update attempts
      await this.env.DB.prepare(
        `UPDATE user_best_scores 
         SET total_attempts = total_attempts + 1,
             average_score = ((average_score * (total_attempts - 1)) + ?) / total_attempts,
             last_played_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(newScore, existing.id)
        .run();
    }
  }

  async getSessionLineScores(sessionId: string): Promise<LineScore[]> {
    const results = await this.env.DB.prepare(
      `SELECT 
        line_index as lineIndex,
        line_text as expectedText,
        transcribed_text as transcribedText,
        score,
        feedback_text as feedback,
        attempt_number as attemptNumber
      FROM line_scores 
      WHERE session_id = ? 
      ORDER BY line_index, created_at`
    )
      .bind(sessionId)
      .all();

    return results.results as unknown as LineScore[];
  }
}