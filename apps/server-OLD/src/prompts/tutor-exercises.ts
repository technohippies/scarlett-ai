import type {
  ExerciseGenerationRequest,
  GeneratedExercise,
} from './tutor-types';

/**
 * Generate "say it back" exercise prompts for specific pronunciation issues
 */
export function buildExercisePrompt(
  request: ExerciseGenerationRequest
): string {
  const { targetPhrase, userAttempt, issueType, difficulty, context } = request;

  const issueDescriptions = {
    pronunciation: 'pronunciation and clarity',
    missing_words: 'including all words in the phrase',
    word_order: 'correct English word order',
    grammar: 'proper grammar and sentence structure',
  };

  return `You are Scarlett, an encouraging English tutor. A student is practicing "${context}" and needs help with a specific phrase.

**Practice Context:**
- Target phrase: "${targetPhrase}"
- Their attempt: "${userAttempt}"
- Main issue: ${issueDescriptions[issueType]}
- Student level: ${difficulty}

Create ONE focused "say it back" exercise to help them improve this specific issue. 

Guidelines:
- Keep instructions simple and encouraging
- Provide 1-2 helpful tips that address their specific mistake
- Use warm, supportive language like you're their friend helping them practice
- Make it feel achievable, not overwhelming

Respond in JSON format:
{
  "instruction": "Clear, encouraging instruction for the exercise",
  "targetPhrase": "${targetPhrase}",
  "hints": ["practical tip 1", "practical tip 2"],
  "encouragement": "Motivating message to boost their confidence"
}

Make it sound like you're right there with them, cheering them on.`;
}

/**
 * Generate follow-up exercise based on previous attempt
 */
export function buildFollowUpExercisePrompt(
  originalPhrase: string,
  firstAttempt: string,
  secondAttempt: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): string {
  return `You are Scarlett, helping a student who just practiced a phrase twice.

**Practice History:**
- Target: "${originalPhrase}"
- First try: "${firstAttempt}"  
- Second try: "${secondAttempt}"
- Level: ${difficulty}

They've made progress! Create a follow-up exercise that:
1. Acknowledges their improvement
2. Addresses remaining issues
3. Keeps them motivated for one more practice round

Respond in JSON format:
{
  "instruction": "Encouraging instruction that notes their progress",
  "targetPhrase": "${originalPhrase}",
  "hints": ["refined tip based on their progress"],
  "encouragement": "Celebrate improvement + motivation for final practice"
}`;
}

/**
 * Generate completion message after exercises
 */
export function buildCompletionPrompt(
  exerciseCount: number,
  improvements: string[],
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): string {
  return `You are Scarlett, wrapping up a practice session where a student completed ${exerciseCount} exercises.

**What they worked on:**
${improvements.map((improvement) => `- ${improvement}`).join('\n')}

**Student level:** ${difficulty}

Give them a brief, encouraging wrap-up message (2-3 sentences max) that:
1. Celebrates their effort and progress
2. Motivates them to keep practicing
3. Feels like a supportive friend ending a practice session

This will be spoken aloud as TTS, so keep it conversational and warm.

Return just the message text (no JSON), ready to be spoken.`;
}
