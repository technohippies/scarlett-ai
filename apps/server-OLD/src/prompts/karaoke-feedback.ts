import type { KaraokePerformanceData, FeedbackResponse } from './types';

/**
 * Generate personalized feedback based on karaoke performance
 */
export function buildKaraokeFeedbackPrompt(
  performance: KaraokePerformanceData
): string {
  const {
    overallScore,
    grade,
    songTitle,
    artistName,
    lineResults,
    performedLines,
    totalLines,
  } = performance;

  // Calculate error patterns
  const lowScoreLines = lineResults.filter((l) => l.score < 70);
  const commonErrors = analyzeCommonErrors(lineResults);

  return `I just finished singing "${songTitle}" by ${artistName} for English practice. Here's my performance data:

**Overall Performance:**
- Score: ${overallScore}% (Grade: ${grade})
- Lines sung: ${performedLines}/${totalLines}

**Detailed Results:**
${lineResults
  .map(
    (line) =>
      `- Expected: "${line.expected}"
  - I sang: "${line.spoken}"
  - Score: ${line.score}%`
  )
  .join('\n')}

**Areas where I struggled (< 70% score):**
${lowScoreLines
  .map((line) => `- "${line.expected}" → "${line.spoken}" (${line.score}%)`)
  .join('\n')}

As my English coach Scarlett, please:

1. **Give me encouraging feedback** about what I did well
2. **Identify 2-3 specific improvement areas** based on my mistakes
3. **Suggest the number of practice exercises** I should do (1-5)
4. **Assess my difficulty level** (beginner/intermediate/advanced)

Please be specific about patterns you notice in my errors (pronunciation, grammar, word order, vocabulary, etc.).

Respond in this JSON format:
{
  "encouragement": "Positive message about their performance",
  "strengths": ["strength1", "strength2"],
  "improvementAreas": ["area1", "area2", "area3"],
  "exerciseCount": 3,
  "difficulty": "intermediate"
}`;
}

/**
 * Analyze common error patterns in performance
 */
function analyzeCommonErrors(
  lineResults: Array<{ expected: string; spoken: string; score: number }>
) {
  const errors = lineResults.filter((l) => l.score < 70);

  return {
    totalErrors: errors.length,
    pronunciationIssues: errors.filter((e) =>
      hasPronunciationSimilarity(e.expected, e.spoken)
    ).length,
    wordOrderIssues: errors.filter((e) =>
      hasWordOrderIssues(e.expected, e.spoken)
    ).length,
    vocabularyIssues: errors.filter((e) =>
      hasVocabularyIssues(e.expected, e.spoken)
    ).length,
  };
}

/**
 * Simple heuristics for error categorization
 */
function hasPronunciationSimilarity(expected: string, spoken: string): boolean {
  const expectedWords = expected.toLowerCase().split(' ');
  const spokenWords = spoken.toLowerCase().split(' ');

  // Check if words are phonetically similar but spelled differently
  const similarWords = expectedWords.filter((ew) =>
    spokenWords.some(
      (sw) => sw.length === ew.length && getEditDistance(sw, ew) <= 2
    )
  );

  return similarWords.length > expectedWords.length * 0.6;
}

function hasWordOrderIssues(expected: string, spoken: string): boolean {
  const expectedWords = new Set(expected.toLowerCase().split(' '));
  const spokenWords = new Set(spoken.toLowerCase().split(' '));

  // If most words are present but in wrong order
  const intersection = new Set(
    [...expectedWords].filter((x) => spokenWords.has(x))
  );
  return intersection.size > expectedWords.size * 0.7;
}

function hasVocabularyIssues(expected: string, spoken: string): boolean {
  const expectedWords = new Set(expected.toLowerCase().split(' '));
  const spokenWords = new Set(spoken.toLowerCase().split(' '));

  const intersection = new Set(
    [...expectedWords].filter((x) => spokenWords.has(x))
  );
  return intersection.size < expectedWords.size * 0.5;
}

function getEditDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}
