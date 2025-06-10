import type {
  TutorAnalysisRequest,
  TutorAnalysisResponse,
} from './tutor-types';

/**
 * Generate analysis and encouragement for karaoke performance
 * Used for initial TTS feedback on completion screen
 */
export function buildTutorAnalysisPrompt(data: TutorAnalysisRequest): string {
  const {
    overallScore,
    grade,
    songTitle,
    artistName,
    incorrectLines,
    totalLines,
    attemptedLines,
  } = data;

  const errorExamples = incorrectLines
    .slice(0, 3)
    .map(
      (line) =>
        `- Expected: "${line.expected}" → You said: "${line.spoken}" (${line.score}%)`
    )
    .join('\n');

  return `You are Scarlett, a friendly English tutor helping someone improve through karaoke practice. 

**Performance Summary:**
- Song: "${songTitle}" by ${artistName}
- Overall Score: ${overallScore}% (Grade: ${grade})
- Lines attempted: ${attemptedLines} out of ${totalLines}
- Lines needing work: ${incorrectLines.length}

**Main Issues:**
${errorExamples}

Provide a brief, encouraging response that will be spoken aloud (like a phone call). In exactly 2-3 sentences:
1. Acknowledge their effort on the song
2. Highlight ONE specific thing they did well (even if score is low)
3. Suggest ONE main area to focus on for improvement

Keep it conversational and warm, like a supportive friend.

Respond in JSON format:
{
  "message": "Your 2-3 sentence spoken feedback here",
  "focusArea": "The main issue to work on",
  "difficulty": "beginner|intermediate|advanced"
}`;
}

/**
 * Helper to determine practice difficulty based on performance
 */
export function determinePracticeDifficulty(
  overallScore: number,
  incorrectLines: number
): 'beginner' | 'intermediate' | 'advanced' {
  if (overallScore < 50 || incorrectLines > 10) return 'beginner';
  if (overallScore < 75 || incorrectLines > 5) return 'intermediate';
  return 'advanced';
}
