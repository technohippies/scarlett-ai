import { doubleMetaphone } from 'double-metaphone';
import type { WordScore } from '../types';

export class ScoringService {
  calculateKaraokeScore(
    expectedText: string,
    transcribedText: string,
    wordTimings: Array<{ word: string; start: number; end: number; confidence: number }> = [],
    attemptNumber: number = 1
  ): { finalScore: number; wordScores: WordScore[] } {
    // Handle empty transcription
    if (!transcribedText || !transcribedText.trim()) {
      return { finalScore: 0, wordScores: [] };
    }

    // Normalize texts
    const normalizedExpected = this.normalizeText(expectedText);
    const normalizedTranscribed = this.normalizeText(transcribedText);
    
    // Debug log normalized texts
    console.log('[Scoring] Normalized comparison:', {
      expected: normalizedExpected,
      transcribed: normalizedTranscribed
    });

    // Calculate base similarity score
    const baseSimilarity = this.calculateStringSimilarity(
      normalizedExpected,
      normalizedTranscribed
    );

    // Calculate phonetic similarity
    const phoneticSimilarity = this.calculatePhoneticSimilarity(
      normalizedExpected,
      normalizedTranscribed
    );

    // Word-level analysis
    const expectedWords = normalizedExpected.split(/\s+/);
    const transcribedWords = normalizedTranscribed.split(/\s+/);
    const wordScores = this.analyzeWords(expectedWords, transcribedWords);

    // Calculate word accuracy
    const wordAccuracy = wordScores.filter((ws) => ws.matched).length / expectedWords.length;

    // Sequence bonus for correct word order
    const sequenceBonus = this.calculateSequenceBonus(expectedWords, transcribedWords);

    // Confidence penalty (if word timings available)
    const avgConfidence = wordTimings.length > 0
      ? wordTimings.reduce((sum, w) => sum + w.confidence, 0) / wordTimings.length
      : 0.8;

    // Attempt bonus (slight boost for first attempts)
    const attemptBonus = attemptNumber === 1 ? 0.05 : 0;

    // Weighted final score
    const finalScore = Math.round(
      Math.min(100, Math.max(0,
        (baseSimilarity * 0.3 +
         phoneticSimilarity * 0.25 +
         wordAccuracy * 0.25 +
         sequenceBonus * 0.1 +
         avgConfidence * 0.1 +
         attemptBonus) * 100
      ))
    );

    return { finalScore, wordScores };
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      // Remove common STT artifacts
      .replace(/\(.*?\)/g, '') // Remove parenthetical descriptions like (music), (chanting)
      .replace(/[^\w\s'-]/g, '') // Keep apostrophes and hyphens
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculatePhoneticSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    let matches = 0;
    let total = Math.max(words1.length, words2.length);

    for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
      if (this.isPhoneticMatch(words1[i], words2[i])) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  private isPhoneticMatch(word1: string, word2: string): boolean {
    if (word1 === word2) return true;
    
    // Common variations to handle
    const variations: Record<string, string[]> = {
      "hurtin'": ['hurting', 'hurtin', 'hurt in'],
      "hurtin": ['hurting', "hurtin'", 'hurt in'],
      "baby": ['babe', 'babies'],
      "babe": ['baby', 'babies'],
      "oh-oh": ['oh oh', 'ohoh', 'oooh', 'oh', 'o o'],
      "oh-ooh-ooh": ['oh ooh ooh', 'ooh ooh ooh', 'oooh oh oh', 'oooh', 'oh oh'],
      "bones": ['bone'],
      "bone": ['bones']
    };
    
    // Check direct variations first
    const w1Lower = word1.toLowerCase();
    const w2Lower = word2.toLowerCase();
    
    if (variations[w1Lower]?.includes(w2Lower)) {
      return true;
    }

    // Skip very short words
    if (word1.length < 3 || word2.length < 3) {
      return word1 === word2;
    }

    // Check for non-Latin scripts
    if (this.hasNonLatinCharacters(word1) || this.hasNonLatinCharacters(word2)) {
      return word1 === word2;
    }

    const [primary1, alternate1] = doubleMetaphone(word1);
    const [primary2, alternate2] = doubleMetaphone(word2);

    return (
      primary1 === primary2 ||
      (typeof alternate1 === 'string' && alternate1 === alternate2) ||
      (typeof alternate1 === 'string' && alternate1 === primary2) ||
      (typeof alternate2 === 'string' && primary1 === alternate2)
    );
  }

  private hasNonLatinCharacters(text: string): boolean {
    return /[^\u0020-\u024F\u1E00-\u1EFF]/.test(text);
  }

  private analyzeWords(
    expectedWords: string[],
    transcribedWords: string[]
  ): WordScore[] {
    const wordScores: WordScore[] = [];

    for (let i = 0; i < expectedWords.length; i++) {
      const expected = expectedWords[i];
      let bestMatch = false;
      let phoneticMatch = false;

      // Look for exact or phonetic match in transcribed words
      for (let j = 0; j < transcribedWords.length; j++) {
        if (expected === transcribedWords[j]) {
          bestMatch = true;
          phoneticMatch = true;
          break;
        } else if (this.isPhoneticMatch(expected, transcribedWords[j])) {
          phoneticMatch = true;
        }
      }

      wordScores.push({
        word: expected,
        score: bestMatch ? 100 : phoneticMatch ? 80 : 0,
        matched: bestMatch || phoneticMatch,
        phoneticMatch,
      });
    }

    return wordScores;
  }

  private calculateSequenceBonus(
    expectedWords: string[],
    transcribedWords: string[]
  ): number {
    let sequenceScore = 0;
    let lastMatchIndex = -1;

    for (const expected of expectedWords) {
      const currentIndex = transcribedWords.indexOf(expected);
      if (currentIndex > lastMatchIndex) {
        sequenceScore++;
        lastMatchIndex = currentIndex;
      }
    }

    return expectedWords.length > 0 ? sequenceScore / expectedWords.length : 0;
  }

  generateFeedback(
    score: number,
    _expectedText: string,
    transcribedText: string,
    attemptNumber: number
  ): string {
    if (!transcribedText.trim()) {
      return attemptNumber === 1
        ? "I couldn't hear you clearly. Try speaking louder! 🎤"
        : "Still having trouble hearing you. Make sure your microphone is working! 🎙️";
    }

    if (score >= 95) {
      return "Perfect! You nailed every word! 🌟";
    } else if (score >= 85) {
      return "Excellent! Your pronunciation is on point! ⭐";
    } else if (score >= 75) {
      return "Great job! You're getting the hang of it! 🎵";
    } else if (score >= 60) {
      return "Good effort! Keep practicing the rhythm! 🎶";
    } else if (score >= 40) {
      return "Nice try! Focus on matching the timing! 🎤";
    } else {
      return attemptNumber >= 2
        ? "Keep practicing! Listen carefully to the melody! 💪"
        : "Don't worry, singing takes practice! Try again! 🎵";
    }
  }
}