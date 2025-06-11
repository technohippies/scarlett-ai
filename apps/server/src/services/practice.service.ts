import { createEmptyCard, fsrs, Rating, State, type Card, type RecordLog } from 'ts-fsrs';
import { nanoid } from 'nanoid';
import type { Env } from '../types';
import { createVeniceService } from './venice.service';

interface PracticeCard {
  id: string;
  user_id: string;
  target_text: string;
  normalized_text?: string;
  
  // FSRS fields
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: string;
  last_review?: string;
  
  // Performance
  best_score: number;
  average_score: number;
  review_count: number;
  contexts_seen: number;
}

interface WordProblem {
  expected: string;
  actual: string;
  position: number;
  score: number;
}

interface PhraseNormalization {
  original_text: string;
  normalized_text: string;
  has_slang: boolean;
  slang_terms?: Record<string, string>;
  dialect_info?: string;
  pronunciation_notes?: Record<string, string>;
}

export class PracticeService {
  constructor(private db: D1Database, private env: Env) {}

  /**
   * Process line errors from a karaoke session and create practice cards
   */
  async processSessionErrors(
    sessionId: string,
    userId: string,
    lineScores: Array<{
      line_index: number;
      line_text: string;
      score: number;
      transcribed_text: string;
    }>
  ): Promise<void> {
    // Only process lines with score < 100
    const problemLines = lineScores.filter(line => line.score < 100);
    
    console.log(`[Practice] Processing ${problemLines.length} problem lines for session ${sessionId}`);
    
    for (const lineScore of problemLines) {
      // Get or create normalization
      const normalization = await this.getNormalization(lineScore.line_text);
      
      // Analyze word-level differences
      const wordProblems = await this.analyzeLineDifferences(
        lineScore.line_text,
        lineScore.transcribed_text,
        normalization
      );
      
      // Create practice cards for real errors
      for (const problem of wordProblems) {
        await this.createOrUpdateCard(userId, problem, {
          sessionId,
          lineIndex: lineScore.line_index,
          fullLine: lineScore.line_text,
          score: lineScore.score
        });
      }
    }
  }

  /**
   * Get or create LLM normalization for a phrase
   */
  private async getNormalization(text: string): Promise<PhraseNormalization> {
    // Check cache first
    const cached = await this.db
      .prepare('SELECT * FROM phrase_normalizations WHERE original_text = ?')
      .bind(text)
      .first<PhraseNormalization>();
    
    if (cached) {
      // Parse JSON fields
      if (typeof cached.slang_terms === 'string') {
        cached.slang_terms = JSON.parse(cached.slang_terms);
      }
      if (typeof cached.pronunciation_notes === 'string') {
        cached.pronunciation_notes = JSON.parse(cached.pronunciation_notes);
      }
      return cached;
    }
    
    // Use Venice LLM for normalization
    const veniceService = createVeniceService(this.env);
    if (!veniceService) {
      // Fallback: simple normalization
      return {
        original_text: text,
        normalized_text: text,
        has_slang: false
      };
    }
    
    const prompt = `
Analyze this song lyric for slang, vernacular, and pronunciation challenges.
Return ONLY valid JSON with no additional text or formatting.

Lyric: "${text}"

Required JSON format:
{
  "normalized_text": "Standard English version (keeping contractions is OK)",
  "has_slang": true/false,
  "slang_terms": {"slang": "standard"},
  "dialect_info": "dialect name or null",
  "pronunciation_notes": {"word": "tip"}
}`;
    
    let response: string | undefined;
    try {
      response = await veniceService.complete(prompt);
      
      // Try to extract JSON from the response (Venice might include extra text)
      let jsonStr = response;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const analysis = JSON.parse(jsonStr);
      
      // Save to cache
      await this.db
        .prepare(`
          INSERT INTO phrase_normalizations (
            id, original_text, normalized_text, has_slang,
            slang_terms, dialect_info, pronunciation_notes, llm_model
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          nanoid(),
          text,
          analysis.normalized_text || text,
          analysis.has_slang || false,
          JSON.stringify(analysis.slang_terms || {}),
          analysis.dialect_info || null,
          JSON.stringify(analysis.pronunciation_notes || {}),
          'venice-v1'
        )
        .run();
      
      return {
        original_text: text,
        normalized_text: analysis.normalized_text || text,
        has_slang: analysis.has_slang || false,
        slang_terms: analysis.slang_terms || {},
        dialect_info: analysis.dialect_info,
        pronunciation_notes: analysis.pronunciation_notes || {}
      };
    } catch (error) {
      console.error('[Practice] LLM normalization failed:', error);
      if (error instanceof SyntaxError && response) {
        console.error('[Practice] Venice response was:', response);
      }
      // Fallback
      return {
        original_text: text,
        normalized_text: text,
        has_slang: false
      };
    }
  }

  /**
   * Analyze differences between expected and transcribed text
   */
  private async analyzeLineDifferences(
    expected: string,
    transcribed: string,
    normalization: PhraseNormalization
  ): Promise<WordProblem[]> {
    const expectedWords = expected.toLowerCase().split(/\s+/);
    const transcribedWords = transcribed.toLowerCase().split(/\s+/);
    const normalizedWords = normalization.normalized_text.toLowerCase().split(/\s+/);
    
    const problems: WordProblem[] = [];
    
    for (let i = 0; i < expectedWords.length; i++) {
      const exp = expectedWords[i];
      const trans = transcribedWords[i] || '';
      const norm = normalizedWords[i] || exp;
      
      // Skip if transcription matches normalized version (valid variation)
      if (trans === norm && exp !== norm) {
        continue; // e.g., "ya" → "you" is valid if normalized
      }
      
      // Skip if it's a known slang variation with high confidence
      if (normalization.slang_terms && normalization.slang_terms[exp] === trans) {
        continue;
      }
      
      // Check for real pronunciation issues
      if (exp !== trans && trans !== '') {
        // Calculate similarity
        const similarity = this.calculateSimilarity(exp, trans);
        
        // It's a real error if:
        // 1. Low similarity
        // 2. Common pronunciation mistakes (er → a, ing → in, th → f/d)
        if (similarity < 0.8 || this.isCommonPronunciationError(exp, trans)) {
          problems.push({
            expected: exp,
            actual: trans,
            position: i,
            score: Math.round(similarity * 100)
          });
        }
      }
    }
    
    return problems;
  }

  /**
   * Simple similarity calculation
   */
  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const track = Array(s2.length + 1).fill(null).map(() =>
      Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i += 1) {
      track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return track[s2.length][s1.length];
  }

  /**
   * Check if this is a common pronunciation error pattern
   */
  private isCommonPronunciationError(expected: string, actual: string): boolean {
    const patterns = [
      { exp: /er$/, act: /a$/ },        // stronger → stronga
      { exp: /ing$/, act: /in$/ },      // going → goin
      { exp: /th/, act: /[fd]/ },       // this → dis, with → wif
      { exp: /^th/, act: /^d/ },        // the → da
      { exp: /ght$/, act: /t$/ },       // right → rite
    ];
    
    return patterns.some(pattern => 
      pattern.exp.test(expected) && pattern.act.test(actual)
    );
  }

  /**
   * Create or update a practice card
   */
  private async createOrUpdateCard(
    userId: string,
    problem: WordProblem,
    context: {
      sessionId: string;
      lineIndex: number;
      fullLine: string;
      score: number;
    }
  ): Promise<void> {
    // Get session details
    const session = await this.db
      .prepare('SELECT track_id FROM karaoke_sessions WHERE id = ?')
      .bind(context.sessionId)
      .first<{ track_id: string }>();
    
    if (!session) return;
    
    // Get song catalog ID from track_id
    const songCatalog = await this.db
      .prepare('SELECT id FROM song_catalog WHERE track_id = ?')
      .bind(session.track_id)
      .first<{ id: string }>();
    
    if (!songCatalog) {
      console.warn('[Practice] Song catalog not found for track_id:', session.track_id);
      // For now, skip creating practice cards if song isn't in catalog
      // TODO: Consider auto-adding songs to catalog
      return;
    }
    
    // Check if card exists
    let card = await this.db
      .prepare('SELECT * FROM practice_cards WHERE user_id = ? AND target_text = ?')
      .bind(userId, problem.expected)
      .first<PracticeCard>();
    
    if (!card) {
      // Create new FSRS card
      const fsrsCard = createEmptyCard();
      
      await this.db
        .prepare(`
          INSERT INTO practice_cards (
            id, user_id, target_text, normalized_text,
            due, stability, difficulty, elapsed_days,
            scheduled_days, reps, lapses, state,
            best_score, average_score, review_count, contexts_seen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          nanoid(),
          userId,
          problem.expected,
          problem.expected, // Will be updated if different
          fsrsCard.due.toISOString(),
          fsrsCard.stability,
          fsrsCard.difficulty,
          fsrsCard.elapsed_days,
          fsrsCard.scheduled_days,
          fsrsCard.reps,
          fsrsCard.lapses,
          State[fsrsCard.state],
          0, // best_score
          0, // average_score
          0, // review_count
          1  // contexts_seen
        )
        .run();
      
      // Get the created card
      card = await this.db
        .prepare('SELECT * FROM practice_cards WHERE user_id = ? AND target_text = ?')
        .bind(userId, problem.expected)
        .first<PracticeCard>();
    } else {
      // Update contexts seen
      await this.db
        .prepare('UPDATE practice_cards SET contexts_seen = contexts_seen + 1 WHERE id = ?')
        .bind(card.id)
        .run();
    }
    
    if (!card) return;
    
    // Add context
    await this.db
      .prepare(`
        INSERT INTO card_contexts (
          id, card_id, session_id, song_id,
          line_index, full_line, position_in_line, original_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        nanoid(),
        card.id,
        context.sessionId,
        songCatalog.id,
        context.lineIndex,
        context.fullLine,
        problem.position,
        context.score
      )
      .run();
    
    // Track pronunciation pattern
    await this.updatePronunciationPattern(userId, problem);
  }

  /**
   * Update user's pronunciation patterns
   */
  private async updatePronunciationPattern(
    userId: string,
    problem: WordProblem
  ): Promise<void> {
    const existing = await this.db
      .prepare('SELECT * FROM pronunciation_patterns WHERE user_id = ? AND expected_word = ?')
      .bind(userId, problem.expected)
      .first<any>();
    
    if (existing) {
      // Update existing pattern
      const mistakes = JSON.parse(existing.common_mistakes || '[]');
      if (!mistakes.includes(problem.actual)) {
        mistakes.push(problem.actual);
      }
      
      await this.db
        .prepare(`
          UPDATE pronunciation_patterns 
          SET common_mistakes = ?, 
              occurrence_count = occurrence_count + 1,
              last_seen = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(JSON.stringify(mistakes), existing.id)
        .run();
    } else {
      // Create new pattern
      await this.db
        .prepare(`
          INSERT INTO pronunciation_patterns (
            id, user_id, problem_type, expected_word,
            common_mistakes, occurrence_count
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          nanoid(),
          userId,
          'substitution', // TODO: detect other types
          problem.expected,
          JSON.stringify([problem.actual]),
          1
        )
        .run();
    }
  }

  /**
   * Get practice exercises for a user
   */
  async getDueExercises(userId: string, limit: number = 10, sessionId?: string): Promise<any[]> {
    // Build query based on whether sessionId is provided
    let query: string;
    let params: any[];
    
    if (sessionId) {
      // Get exercises only from the specific session
      query = `
        SELECT DISTINCT 
          pc.*,
          cc.full_line,
          cc.song_id,
          cc.line_index,
          cc.session_id,
          sc.title as song_title,
          sc.artist as song_artist
        FROM practice_cards pc
        JOIN card_contexts cc ON pc.id = cc.card_id
        JOIN song_catalog sc ON cc.song_id = sc.id
        WHERE pc.user_id = ? 
          AND cc.session_id = ?
          AND datetime(pc.due) <= datetime('now')
        ORDER BY cc.line_index ASC
        LIMIT ?
      `;
      params = [userId, sessionId, limit];
    } else {
      // Get all due exercises
      query = `
        SELECT DISTINCT 
          pc.*,
          cc.full_line,
          cc.song_id,
          cc.line_index,
          sc.title as song_title,
          sc.artist as song_artist
        FROM practice_cards pc
        JOIN card_contexts cc ON pc.id = cc.card_id
        JOIN song_catalog sc ON cc.song_id = sc.id
        WHERE pc.user_id = ? AND datetime(pc.due) <= datetime('now')
        ORDER BY pc.due ASC
        LIMIT ?
      `;
      params = [userId, limit];
    }
    
    // Get due cards with context
    const dueCards = await this.db
      .prepare(query)
      .bind(...params)
      .all<any>();
    
    if (!dueCards.results || dueCards.results.length === 0) {
      return [];
    }
    
    // Group by line to create exercises
    const lineGroups = new Map<string, any[]>();
    
    for (const card of dueCards.results) {
      const key = `${card.full_line}-${card.song_id}`;
      if (!lineGroups.has(key)) {
        lineGroups.set(key, []);
      }
      lineGroups.get(key)!.push(card);
    }
    
    // Create ReadAloud exercises
    const exercises = [];
    for (const [key, cards] of lineGroups) {
      const firstCard = cards[0];
      
      exercises.push({
        id: nanoid(),
        type: 'read_aloud',
        full_line: firstCard.full_line,
        focus_words: cards.map((c: any) => c.target_text),
        card_ids: cards.map((c: any) => c.id),
        song_context: {
          title: firstCard.song_title,
          artist: firstCard.song_artist,
          song_id: firstCard.song_id,
          line_index: firstCard.line_index
        }
      });
    }
    
    return exercises;
  }

  /**
   * Review a ReadAloud exercise
   */
  async reviewExercise(
    exerciseId: string,
    userId: string,
    transcription: string,
    cardScores: Array<{ cardId: string; score: number }>
  ): Promise<any> {
    const f = fsrs();
    const results = [];
    
    for (const { cardId, score } of cardScores) {
      // Get card
      const card = await this.db
        .prepare('SELECT * FROM practice_cards WHERE id = ?')
        .bind(cardId)
        .first<PracticeCard>();
      
      if (!card) continue;
      
      // Convert to FSRS card
      const fsrsCard: Card = {
        due: new Date(card.due),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: State[card.state as keyof typeof State],
        last_review: card.last_review ? new Date(card.last_review) : undefined
      };
      
      // Calculate rating based on score
      const rating = score >= 90 ? Rating.Easy :
                     score >= 75 ? Rating.Good :
                     score >= 60 ? Rating.Hard :
                     Rating.Again;
      
      // Get next card state
      const scheduling = f.repeat(fsrsCard, new Date());
      const nextCard = scheduling[rating].card;
      
      // Update card
      await this.db
        .prepare(`
          UPDATE practice_cards SET
            due = ?, stability = ?, difficulty = ?,
            elapsed_days = ?, scheduled_days = ?,
            reps = ?, lapses = ?, state = ?,
            last_review = ?,
            best_score = MAX(best_score, ?),
            average_score = (average_score * review_count + ?) / (review_count + 1),
            review_count = review_count + 1
          WHERE id = ?
        `)
        .bind(
          nextCard.due.toISOString(),
          nextCard.stability,
          nextCard.difficulty,
          nextCard.elapsed_days,
          nextCard.scheduled_days,
          nextCard.reps,
          nextCard.lapses,
          State[nextCard.state],
          new Date().toISOString(),
          score,
          score,
          cardId
        )
        .run();
      
      // Log review
      await this.db
        .prepare(`
          INSERT INTO card_reviews (
            id, card_id, user_id, score, transcription,
            rating, stability_before, difficulty_before
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          nanoid(),
          cardId,
          userId,
          score,
          transcription,
          Rating[rating],
          card.stability,
          card.difficulty
        )
        .run();
      
      results.push({
        word: card.target_text,
        score,
        rating: Rating[rating],
        nextReview: nextCard.due
      });
    }
    
    return {
      results,
      overallScore: results.reduce((sum, r) => sum + r.score, 0) / results.length
    };
  }
}

// Factory function
export function createPracticeService(db: D1Database, env: Env): PracticeService {
  return new PracticeService(db, env);
}