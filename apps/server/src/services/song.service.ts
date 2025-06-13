import { nanoid } from 'nanoid';
import type { Env, Song, PaginatedResponse } from '../types';
import { NotFoundError } from '../types';

export class SongService {
  constructor(private env: Env) {}

  async getSongByTrackId(trackId: string): Promise<Song | null> {
    const result = await this.env.DB.prepare(
      `SELECT 
        id, track_id as trackId, title, artist, album, duration_ms as durationMs,
        difficulty, genius_id as geniusId, genius_url as geniusUrl,
        genius_confidence as geniusConfidence, soundcloud_match as soundcloudMatch,
        artwork_url as artworkUrl, lyrics_source as lyricsSource,
        lyrics_type as lyricsType, lyrics_lines_count as lyricsLinesCount,
        total_attempts as totalAttempts, total_completions as totalCompletions,
        success_rate as successRate, unique_users_attempted as uniqueUsersAttempted,
        last_played_at as lastPlayedAt, created_at as createdAt,
        updated_at as updatedAt
      FROM song_catalog 
      WHERE track_id = ?`
    )
      .bind(trackId)
      .first();

    return result as Song | null;
  }

  async getSongById(songId: string): Promise<Song | null> {
    const result = await this.env.DB.prepare(
      `SELECT 
        id, track_id as trackId, title, artist, album, duration_ms as durationMs,
        difficulty, genius_id as geniusId, genius_url as geniusUrl,
        genius_confidence as geniusConfidence, soundcloud_match as soundcloudMatch,
        artwork_url as artworkUrl, lyrics_source as lyricsSource,
        lyrics_type as lyricsType, lyrics_lines_count as lyricsLinesCount,
        total_attempts as totalAttempts, total_completions as totalCompletions,
        success_rate as successRate, unique_users_attempted as uniqueUsersAttempted,
        last_played_at as lastPlayedAt, created_at as createdAt,
        updated_at as updatedAt
      FROM song_catalog 
      WHERE id = ? OR genius_id = ?`
    )
      .bind(songId, songId)
      .first();

    return result as Song | null;
  }

  async createOrUpdateSong(
    trackId: string,
    songData: {
      title: string;
      artist: string;
      album?: string;
      durationMs?: number;
      difficulty: 'beginner' | 'intermediate' | 'advanced';
      geniusId?: string;
      geniusUrl?: string;
      geniusConfidence?: number;
      soundcloudMatch?: boolean;
      artworkUrl?: string;
      lyricsSource: 'genius' | 'lrclib';
      lyricsType: 'synced' | 'unsynced';
      lyricsLinesCount: number;
    }
  ): Promise<Song> {
    const existing = await this.getSongByTrackId(trackId);

    if (existing) {
      // Update existing song
      await this.env.DB.prepare(
        `UPDATE song_catalog 
         SET total_attempts = total_attempts + 1,
             last_played_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(existing.id)
        .run();

      return { ...existing, totalAttempts: existing.totalAttempts + 1 };
    }

    // Create new song
    const songId = nanoid();
    const now = new Date().toISOString();

    await this.env.DB.prepare(
      `INSERT INTO song_catalog (
        id, track_id, title, artist, album, duration_ms, difficulty,
        genius_id, genius_url, genius_confidence, soundcloud_match, artwork_url,
        lyrics_source, lyrics_type, lyrics_lines_count, total_attempts,
        unique_users_attempted, last_played_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`
    )
      .bind(
        songId,
        trackId,
        songData.title,
        songData.artist,
        songData.album || null,
        songData.durationMs || null,
        songData.difficulty,
        songData.geniusId || null,
        songData.geniusUrl || null,
        songData.geniusConfidence || 0,
        songData.soundcloudMatch || false,
        songData.artworkUrl || null,
        songData.lyricsSource,
        songData.lyricsType,
        songData.lyricsLinesCount,
        now,
        now,
        now
      )
      .run();

    const created = await this.getSongById(songId);
    if (!created) {
      throw new Error('Failed to create song');
    }

    return created;
  }

  async logSongMatch(
    trackId: string,
    songCatalogId: string,
    searchQuery: string,
    geniusConfidence: number,
    soundcloudMatch: boolean,
    matchMethod: string
  ): Promise<void> {
    const eventId = nanoid();

    await this.env.DB.prepare(
      `INSERT INTO song_match_events (
        id, track_id, song_catalog_id, search_query, genius_confidence,
        soundcloud_match, match_method, success, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP)`
    )
      .bind(
        eventId,
        trackId,
        songCatalogId,
        searchQuery,
        geniusConfidence,
        soundcloudMatch,
        matchMethod
      )
      .run();
  }

  async getPopularSongs(
    page: number = 1,
    limit: number = 20,
    difficulty?: string
  ): Promise<PaginatedResponse<Song>> {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        id, track_id as trackId, title, artist, album, duration_ms as durationMs,
        difficulty, genius_id as geniusId, genius_url as geniusUrl,
        artwork_url as artworkUrl, lyrics_type as lyricsType,
        total_attempts as totalAttempts, success_rate as successRate,
        unique_users_attempted as uniqueUsersAttempted,
        last_played_at as lastPlayedAt, created_at as createdAt
      FROM song_catalog 
      WHERE total_attempts > 0`;

    let countQuery = `
      SELECT COUNT(*) as total 
      FROM song_catalog 
      WHERE total_attempts > 0`;

    const params: (string | number)[] = [];

    if (difficulty) {
      query += ' AND difficulty = ?';
      countQuery += ' AND difficulty = ?';
      params.push(difficulty);
    }

    query += ' ORDER BY total_attempts DESC, success_rate DESC LIMIT ? OFFSET ?';

    const [songs, count] = await Promise.all([
      this.env.DB.prepare(query)
        .bind(...params, limit, offset)
        .all(),
      this.env.DB.prepare(countQuery)
        .bind(...params)
        .first(),
    ]);

    const total = (count as { total: number })?.total || 0;

    return {
      success: true,
      data: songs.results as unknown as Song[],
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  async getTrendingSongs(
    timeframe: '24h' | '7d' | '30d' | 'all' = '7d',
    limit: number = 20
  ): Promise<Song[]> {
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
    }

    const query = `
      SELECT 
        id, track_id as trackId, title, artist, album, duration_ms as durationMs,
        difficulty, artwork_url as artworkUrl, lyrics_type as lyricsType,
        total_attempts as totalAttempts, unique_users_attempted as uniqueUsersAttempted,
        last_played_at as lastPlayedAt, created_at as createdAt
      FROM song_catalog 
      WHERE total_attempts > 0 ${dateFilter}
      ORDER BY 
        CASE 
          WHEN '${timeframe}' = 'all' THEN total_attempts
          ELSE unique_users_attempted * 2 + total_attempts
        END DESC,
        last_played_at DESC
      LIMIT ?`;

    const result = await this.env.DB.prepare(query).bind(limit).all();

    return result.results as unknown as Song[];
  }

  async getSongLeaderboard(
    songId: string,
    limit: number = 10
  ): Promise<{
    songId: string;
    leaderboard: Array<{
      rank: number;
      userId: string;
      displayName: string;
      bestScore: number;
      achievedAt: string;
      totalAttempts: number;
    }>;
  }> {
    const song = await this.getSongById(songId);
    if (!song) {
      throw new NotFoundError('Song');
    }

    const results = await this.env.DB.prepare(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY ub.best_score DESC, ub.achieved_at ASC) as rank,
        ub.user_id as userId,
        u.display_name as displayName,
        ub.best_score as bestScore,
        ub.achieved_at as achievedAt,
        ub.total_attempts as totalAttempts
      FROM user_best_scores ub
      JOIN users u ON ub.user_id = u.id
      WHERE ub.song_id = ?
      ORDER BY ub.best_score DESC, ub.achieved_at ASC
      LIMIT ?`
    )
      .bind(songId, limit)
      .all();

    return {
      songId,
      leaderboard: results.results as Array<{
        rank: number;
        userId: string;
        displayName: string;
        bestScore: number;
        achievedAt: string;
        totalAttempts: number;
      }>,
    };
  }

  async searchSongs(query: string, limit: number = 20): Promise<Song[]> {
    // Search in title and artist fields
    const searchPattern = `%${query}%`;
    
    const results = await this.env.DB.prepare(
      `SELECT 
        id, track_id as trackId, title, artist, album, duration_ms as durationMs,
        difficulty, genius_id as geniusId, genius_url as geniusUrl,
        genius_confidence as geniusConfidence, soundcloud_match as soundcloudMatch,
        artwork_url as artworkUrl, lyrics_source as lyricsSource,
        lyrics_type as lyricsType, lyrics_lines_count as lyricsLinesCount,
        total_attempts as totalAttempts, total_completions as totalCompletions,
        success_rate as successRate, unique_users_attempted as uniqueUsersAttempted,
        last_played_at as lastPlayedAt, created_at as createdAt,
        updated_at as updatedAt
      FROM song_catalog 
      WHERE (title LIKE ? OR artist LIKE ?)
      AND lyrics_type != 'none'
      ORDER BY total_attempts DESC
      LIMIT ?`
    )
      .bind(searchPattern, searchPattern, limit)
      .all();

    return results.results as Song[];
  }
}