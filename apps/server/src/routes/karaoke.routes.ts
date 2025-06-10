import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, User } from '../types';
import { NotFoundError } from '../types';
import { 
  AuthService, 
  SessionService, 
  SongService, 
  LyricsService, 
  GeniusService,
  ScoringService,
  STTService 
} from '../services';
import { authMiddleware, requireCredits } from '../middleware';
import { validateBody, validateQuery } from '../middleware';
import { 
  createSessionSchema, 
  songQuerySchema,
  gradeAudioSchema
} from '../utils/validation';

const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    user?: User;
    validatedBody?: any;
    validatedQuery?: any;
    validatedParams?: any;
  };
}>();

// GET /api/karaoke/:trackId - Get karaoke data for a track
app.get('/:trackId', validateQuery(songQuerySchema), async (c) => {
  const trackId = c.req.param('trackId');
  const query = c.get('validatedQuery') as z.infer<typeof songQuerySchema> | undefined;
  const { title = '', artist = '' } = query || {};

  const songService = new SongService(c.env);
  const lyricsService = new LyricsService();
  const geniusService = new GeniusService(c.env.GENIUS_API_KEY || '');

  // Check if song exists in catalog
  let song = await songService.getSongByTrackId(trackId);
  if (song && song.lyricsType === 'synced') {
    return c.json({
      success: true,
      trackId,
      hasKaraoke: true,
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        artworkUrl: song.artworkUrl,
        duration: song.durationMs,
        difficulty: song.difficulty,
      },
      cached: true,
    });
  }

  // Search for lyrics
  const searchQuery = artist && title ? `${artist} ${title}` : title || trackId;
  
  // Try Genius for metadata
  const geniusMatch = await geniusService.findSongMatch(searchQuery, trackId);
  
  // Search lyrics
  const lyricsResult = await lyricsService.searchLyrics({
    track_name: geniusMatch.song?.title || title,
    artist_name: geniusMatch.song?.primary_artist.name || artist,
    album_name: geniusMatch.song?.album?.name,
  });

  if (lyricsResult.type === 'none') {
    return c.json({
      success: true,
      trackId,
      hasKaraoke: false,
      message: 'No lyrics found for this track',
    });
  }

  if (lyricsResult.type === 'unsynced') {
    return c.json({
      success: true,
      trackId,
      hasKaraoke: false,
      message: 'Lyrics found but no synchronized timing available',
    });
  }

  // Process synced lyrics
  const processedLyrics = lyricsService.processSyncedLyrics(lyricsResult.lyrics);

  // Create or update song in catalog
  const songData = {
    title: geniusMatch.song?.title || title,
    artist: geniusMatch.song?.primary_artist.name || artist,
    album: geniusMatch.song?.album?.name,
    durationMs: lyricsResult.metadata?.duration ? lyricsResult.metadata.duration * 1000 : undefined,
    difficulty: (processedLyrics.length > 50 ? 'advanced' : processedLyrics.length > 25 ? 'intermediate' : 'beginner') as 'beginner' | 'intermediate' | 'advanced',
    geniusId: geniusMatch.song?.id.toString(),
    geniusUrl: geniusMatch.song?.url,
    geniusConfidence: geniusMatch.confidence,
    soundcloudMatch: geniusMatch.confidence > 0.9,
    artworkUrl: geniusMatch.song?.song_art_image_url,
    lyricsSource: 'lrclib' as const,
    lyricsType: 'synced' as const,
    lyricsLinesCount: processedLyrics.length,
  };

  song = await songService.createOrUpdateSong(trackId, songData);

  // Log the match
  await songService.logSongMatch(
    trackId,
    song.id,
    searchQuery,
    geniusMatch.confidence,
    geniusMatch.confidence > 0.9,
    geniusMatch.confidence > 0.9 ? 'genius_soundcloud' : 'lrclib_direct'
  );

  return c.json({
    success: true,
    trackId,
    hasKaraoke: true,
    song: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artworkUrl: song.artworkUrl,
      duration: song.durationMs,
      difficulty: song.difficulty,
      geniusId: song.geniusId,
      geniusUrl: song.geniusUrl,
    },
    lyrics: {
      source: 'lrclib',
      type: 'synced',
      lines: processedLyrics,
      totalLines: processedLyrics.length,
    },
    cached: false,
    geniusConfidence: geniusMatch.confidence,
  });
});

// POST /api/karaoke/start - Start a karaoke session
app.post('/start', authMiddleware, requireCredits(1), validateBody(createSessionSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof createSessionSchema>;
  const user = c.get('user')!;

  const sessionService = new SessionService(c.env);
  const authService = new AuthService(c.env);

  // Create session
  const session = await sessionService.createSession(user.id, data.trackId, data.songData);

  // Deduct credits
  await authService.useCredits(user.id, 1);

  return c.json({
    success: true,
    sessionId: session.id,
    message: `Karaoke session started for ${session.songArtist} - ${session.songTitle}`,
    session: {
      id: session.id,
      trackId: session.trackId,
      songTitle: session.songTitle,
      songArtist: session.songArtist,
      status: session.status,
      createdAt: session.createdAt,
    },
  });
});

// POST /api/karaoke/grade - Grade a single line
app.post('/grade', authMiddleware, validateBody(gradeAudioSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof gradeAudioSchema>;
  const user = c.get('user')!;

  const sessionService = new SessionService(c.env);
  const sttService = new STTService(c.env);
  const scoringService = new ScoringService();

  // Verify session exists and belongs to user
  const session = await sessionService.getSession(data.sessionId, user.id);
  if (!session) {
    throw new NotFoundError('Session');
  }

  // Decode and transcribe audio
  const audioBuffer = Uint8Array.from(atob(data.audioData), (c) => c.charCodeAt(0));
  const transcriptionResult = await sttService.transcribeAudio(audioBuffer, data.expectedText);

  // Calculate score
  const { finalScore, wordScores } = scoringService.calculateKaraokeScore(
    data.expectedText,
    transcriptionResult.transcript,
    transcriptionResult.words,
    data.attemptNumber
  );

  const feedback = scoringService.generateFeedback(
    finalScore,
    data.expectedText,
    transcriptionResult.transcript,
    data.attemptNumber
  );

  // Record line score
  await sessionService.recordLineScore(data.sessionId, {
    lineIndex: data.lineIndex,
    expectedText: data.expectedText,
    transcribedText: transcriptionResult.transcript,
    score: finalScore,
    feedback,
    attemptNumber: data.attemptNumber,
    confidence: transcriptionResult.confidence,
    wordScores,
  });

  return c.json({
    success: true,
    sessionId: data.sessionId,
    lineIndex: data.lineIndex,
    score: finalScore,
    feedback,
    transcribedText: transcriptionResult.transcript,
    wordTimings: transcriptionResult.words,
    wordScores,
    confidence: transcriptionResult.confidence,
  });
});

// GET /api/karaoke/session/:sessionId - Get session details
app.get('/session/:sessionId', authMiddleware, async (c) => {
  const sessionId = c.req.param('sessionId');
  const user = c.get('user')!;

  const sessionService = new SessionService(c.env);
  
  const session = await sessionService.getSession(sessionId, user.id);
  if (!session) {
    throw new NotFoundError('Session');
  }

  const lineScores = await sessionService.getSessionLineScores(sessionId);

  return c.json({
    success: true,
    session: {
      ...session,
      lineScores,
    },
  });
});

// POST /api/karaoke/session/:sessionId/complete - Complete a session
app.post('/session/:sessionId/complete', authMiddleware, async (c) => {
  const sessionId = c.req.param('sessionId');
  const user = c.get('user')!;

  const sessionService = new SessionService(c.env);
  
  const session = await sessionService.getSession(sessionId, user.id);
  if (!session) {
    throw new NotFoundError('Session');
  }

  const lineScores = await sessionService.getSessionLineScores(sessionId);
  const overallScore = lineScores.length > 0
    ? Math.round(lineScores.reduce((sum, ls) => sum + ls.score, 0) / lineScores.length)
    : 0;

  await sessionService.completeSession(sessionId, lineScores.length, overallScore);

  return c.json({
    success: true,
    sessionId,
    overallScore,
    linesCompleted: lineScores.length,
    message: 'Session completed successfully',
  });
});

export default app;