/**
 * Scoring Service
 *
 * Handles all karaoke scoring logic including:
 * - Text similarity calculations
 * - Phonetic matching
 * - Word-level scoring
 * - Sequence bonuses
 */

import { doubleMetaphone } from 'double-metaphone';

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface WordScore {
  expected: string;
  transcribed: string;
  score: number;
}

export interface LineResult {
  expected: string;
  spoken: string;
  score: number;
}

/**
 * Calculate karaoke score with word-level analysis
 */
export function calculateKaraokeScoreWithWords(
  expectedText: string,
  transcribedText: string,
  wordTimings: WordTiming[] | undefined,
  attemptNumber: number
): { finalScore: number; wordScores: WordScore[] | undefined } {
  console.log('[Scoring] Calculating score with word-level analysis...');
  console.log(`[Scoring] Attempt #${attemptNumber}`);
  console.log(`[Scoring] Expected: "${expectedText}"`);
  console.log(`[Scoring] Transcribed: "${transcribedText}"`);

  // Base text score
  const textScore = calculateKaraokeScore(
    expectedText,
    transcribedText,
    attemptNumber
  );

  // If no word timings, just return text score
  if (!wordTimings || wordTimings.length === 0) {
    console.log('[Scoring] No word timings available, using text score only');
    return { finalScore: textScore, wordScores: undefined };
  }

  // Calculate word-level scores
  const expectedWords = normalizeForScoring(expectedText)
    .split(' ')
    .filter((w) => w.length > 0);
  const transcribedWords = wordTimings.map((w) =>
    normalizeForScoring(w.word).trim()
  );

  const wordScores: WordScore[] = [];
  const usedIndices = new Set<number>();

  for (const expectedWord of expectedWords) {
    let bestMatch = 0;
    let bestIndex = -1;
    let bestTranscribed = '';

    for (let i = 0; i < transcribedWords.length; i++) {
      if (usedIndices.has(i)) continue;

      const transcribedWord = transcribedWords[i];
      const score = calculateWordScore(expectedWord, transcribedWord);

      if (score > bestMatch) {
        bestMatch = score;
        bestIndex = i;
        bestTranscribed = transcribedWord;
      }
    }

    if (bestIndex >= 0) {
      usedIndices.add(bestIndex);
    }

    wordScores.push({
      expected: expectedWord,
      transcribed: bestTranscribed || '',
      score: Math.round(bestMatch * 100),
    });
  }

  // Combine text score with word confidence
  const avgWordScore =
    wordScores.reduce((sum, ws) => sum + ws.score, 0) / wordScores.length;
  const avgConfidence =
    wordTimings.reduce((sum, wt) => sum + wt.confidence, 0) /
    wordTimings.length;

  const confidenceBonus = avgConfidence > 0.8 ? 5 : 0;
  const finalScore = Math.round(
    textScore * 0.7 + avgWordScore * 0.3 + confidenceBonus
  );

  console.log(
    `[Scoring] Word scores: avg=${avgWordScore.toFixed(1)}, confidence=${avgConfidence.toFixed(2)}`
  );
  console.log(`[Scoring] Final score: ${finalScore}`);

  return {
    finalScore: Math.min(100, Math.max(0, finalScore)),
    wordScores,
  };
}

/**
 * Calculate word-level score between expected and transcribed
 */
function calculateWordScore(expected: string, transcribed: string): number {
  if (expected === transcribed) return 1.0;

  // Phonetic similarity
  const phoneticScore = calculatePhoneticSimilarity(expected, transcribed);
  if (phoneticScore >= 0.8) return phoneticScore;

  // String similarity
  const stringScore = calculateStringSimilarity(expected, transcribed);
  return Math.max(phoneticScore, stringScore);
}

/**
 * Main karaoke scoring function with enhanced multi-line support
 */
export function calculateKaraokeScore(
  expectedText: string,
  transcribedText: string,
  attemptNumber: number
): number {
  // Normalize text for comparison with singing-specific processing
  const normalize = (text: string) => {
    // Strip parenthetical content (e.g., "(music)", "(static)", "(laughs)")
    let cleaned = text.replace(/\([^)]*\)/g, '').trim();

    // First, check for non-Latin scripts (Korean, Chinese, etc.)
    // Excluding control characters \u0000-\u001F from the Latin range
    const hasNonLatin = /[^\u0020-\u024F\u1E00-\u1EFF\s]/g.test(cleaned);
    if (hasNonLatin) {
      console.log(
        '[Scoring] Non-Latin script detected, skipping transcription'
      );
      return ''; // Return empty string for non-Latin text
    }

    return (
      cleaned
        .toLowerCase()
        // Remove ALL parenthetical content (background vocals, commentary, etc.)
        .replace(/\([^)]*\)/g, ' ')
        // Remove ALL bracketed content
        .replace(/\[[^\]]*\]/g, ' ')
        // Remove obvious transcription artifacts and non-singing content
        .replace(
          /\b(background|noise|music|instrumental|machine|sounds|continue)\b/g,
          ''
        )
        // Remove speaking patterns that aren't singing
        .replace(
          /\b(you know|i'm not sure|going to try|can you hear me|speak a little|bit louder)\b/g,
          ''
        )
        // Handle hyphenated singing expressions (oh-oh, la-la, etc.)
        .replace(/\b(\w+)-(\w+)\b/g, '$1$2') // oh-oh -> ohoh
        // Fix word cut-offs and artifacts
        .replace(/\b(\w+)--+/g, '$1') // Remove trailing dashes
        .replace(/--+/g, ' ') // Replace multiple dashes with space
        // Remove most punctuation but keep apostrophes
        .replace(/[^\w\s']/g, ' ')
        // Basic contraction normalization (essential ones only)
        .replace(/\b(\w+)'re\b/g, '$1re') // you're -> youre, they're -> theyre
        .replace(/\b(\w+)'ll\b/g, '$1ll') // we'll -> well, you'll -> youll
        .replace(/\b(\w+)'ve\b/g, '$1ve') // I've -> ive, we've -> weve
        .replace(/\b(\w+)n't\b/g, '$1nt') // don't -> dont, can't -> cant
        // Remove excessive repeated characters (keep max 2)
        .replace(/(.)\1{2,}/g, '$1$1')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  };

  const expected = normalize(expectedText);
  const transcribed = normalize(transcribedText);

  console.log(`[Scoring] Expected: "${expected}"`);
  console.log(`[Scoring] Transcribed: "${transcribed}"`);

  // Calculate word-level accuracy using enhanced matching
  const expectedWords = expected.split(' ').filter((w) => w.length > 0);
  const transcribedWords = transcribed.split(' ').filter((w) => w.length > 0);

  // Handle edge cases
  if (expectedWords.length === 0) {
    // If expected text was all parentheses/brackets (non-singing content),
    // don't give credit for not singing
    console.log(
      '[Scoring] Expected text was empty after normalization (likely parenthetical content)'
    );
    return 15; // Minimum score for non-singing content
  }

  // If transcription is empty or very poor (non-Latin, only artifacts), give minimum score
  if (transcribedWords.length === 0 || transcribed.trim() === '') {
    console.log(
      '[Scoring] Empty or invalid transcription, giving minimum score'
    );
    return 15; // Slightly higher minimum for complete transcription failure
  }

  // Use multiple matching strategies with adaptive thresholds
  let matchedWords = 0;
  const usedIndices = new Set<number>();

  for (const expectedWord of expectedWords) {
    let bestMatch = 0;
    let bestIndex = -1;

    // Skip very short words (< 2 chars) - they're often transcription noise
    if (expectedWord.length < 2) {
      matchedWords += 0.5; // Give partial credit
      continue;
    }

    for (let i = 0; i < transcribedWords.length; i++) {
      if (usedIndices.has(i)) continue;

      const transcribedWord = transcribedWords[i];

      // Strategy 1: Exact match
      if (expectedWord === transcribedWord) {
        bestMatch = 1.0;
        bestIndex = i;
        break;
      }

      // Strategy 2: Phonetic similarity (prioritize this for singing)
      const phoneticSimilarity = calculatePhoneticSimilarity(
        expectedWord,
        transcribedWord
      );
      if (phoneticSimilarity > bestMatch && phoneticSimilarity >= 0.6) {
        bestMatch = phoneticSimilarity;
        bestIndex = i;
      }

      // Strategy 3: String similarity (more forgiving thresholds)
      const similarity = calculateStringSimilarity(
        expectedWord,
        transcribedWord
      );
      if (similarity > bestMatch && similarity >= 0.6) {
        bestMatch = similarity;
        bestIndex = i;
      }

      // Strategy 4: Partial word matching for longer words
      if (expectedWord.length >= 4 && transcribedWord.length >= 4) {
        const isSubstring =
          expectedWord.includes(transcribedWord) ||
          transcribedWord.includes(expectedWord);
        if (isSubstring && 0.7 > bestMatch) {
          bestMatch = 0.7;
          bestIndex = i;
        }
      }
    }

    if (bestMatch > 0 && bestIndex >= 0) {
      matchedWords += bestMatch;
      usedIndices.add(bestIndex);
    }
  }

  // Base score: percentage of words matched (more generous)
  const wordAccuracy = Math.min(1.0, matchedWords / expectedWords.length);
  let baseScore = wordAccuracy * 100;

  // Sequence bonus for maintaining word order
  const sequenceBonus = calculateSequenceBonus(expectedWords, transcribedWords);
  baseScore += sequenceBonus;

  // More forgiving length handling - focus on extra words rather than missing
  const extraWords = Math.max(
    0,
    transcribedWords.length - expectedWords.length
  );
  const lengthPenalty = Math.min(10, extraWords * 2); // Reduced penalty
  baseScore -= lengthPenalty;

  // Attempt bonus for multiple tries (encourage practice!)
  const attemptBonus = attemptNumber > 1 ? Math.min(5, attemptNumber * 2) : 0;
  baseScore += attemptBonus;

  // Round and clamp score
  const finalScore = Math.round(Math.min(100, Math.max(10, baseScore)));

  console.log(`[Scoring] Word accuracy: ${(wordAccuracy * 100).toFixed(1)}%`);
  console.log(
    `[Scoring] Bonuses - Sequence: +${sequenceBonus}, Attempt: +${attemptBonus}`
  );
  console.log(`[Scoring] Penalties - Length: -${lengthPenalty}`);
  console.log(`[Scoring] Final score: ${finalScore}`);

  return finalScore;
}

/**
 * Calculate phonetic similarity between two words using Double Metaphone
 */
export function calculatePhoneticSimilarity(
  word1: string,
  word2: string
): number {
  const [primary1, alternate1] = doubleMetaphone(word1);
  const [primary2, alternate2] = doubleMetaphone(word2);

  // Check all combinations of phonetic representations
  if (primary1 === primary2 || primary1 === alternate2) return 1.0;
  if (alternate1 && (alternate1 === primary2 || alternate1 === alternate2))
    return 0.95;

  // Partial phonetic match - check if one is substring of the other
  if (primary1 && primary2) {
    if (primary1.includes(primary2) || primary2.includes(primary1)) {
      return 0.7;
    }
  }

  // Calculate similarity based on common characters
  const maxLen = Math.max(primary1?.length || 0, primary2?.length || 0);
  if (maxLen === 0) return 0;

  let common = 0;
  const p1 = primary1 || '';
  const p2 = primary2 || '';
  for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
    if (p1[i] === p2[i]) common++;
  }

  return common / maxLen;
}

/**
 * Calculate sequence bonus for maintaining word order
 */
export function calculateSequenceBonus(
  expectedWords: string[],
  transcribedWords: string[]
): number {
  let longestSequence = 0;
  let currentSequence = 0;
  let lastMatchIndex = -1;

  for (const expectedWord of expectedWords) {
    let found = false;
    for (let i = lastMatchIndex + 1; i < transcribedWords.length; i++) {
      if (
        expectedWord === transcribedWords[i] ||
        calculatePhoneticSimilarity(expectedWord, transcribedWords[i]) > 0.8
      ) {
        found = true;
        lastMatchIndex = i;
        currentSequence++;
        longestSequence = Math.max(longestSequence, currentSequence);
        break;
      }
    }
    if (!found) {
      currentSequence = 0;
    }
  }

  // Bonus for maintaining word order (up to 10 points)
  return Math.min(10, longestSequence * 2);
}

/**
 * Calculate string similarity using Levenshtein-like algorithm
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);

  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Normalize text for scoring comparison
 */
function normalizeForScoring(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate feedback based on score
 */
export function generateFeedback(
  score: number,
  expectedText: string,
  transcribedText: string,
  attemptNumber: number
): string {
  if (score >= 95) {
    return '🌟 Perfect! Absolutely nailed it!';
  } else if (score >= 85) {
    return '🎯 Excellent! You got almost every word right!';
  } else if (score >= 75) {
    return '✨ Great job! Just a few words off.';
  } else if (score >= 65) {
    return '👍 Good effort! Keep practicing those tricky parts.';
  } else if (score >= 50) {
    return '💪 Not bad! Try to match the timing better.';
  } else {
    return attemptNumber > 1
      ? "🎵 Keep trying! You're getting closer!"
      : '🎤 Give it another shot! Listen to the rhythm.';
  }
}
