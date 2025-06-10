import type { ExerciseRequest, GeneratedExercise } from './types';

/**
 * Generate practice exercises based on specific errors
 */
export function buildExerciseGenerationPrompt(
  request: ExerciseRequest,
  feedbackContext: string
): string {
  const { type, targetText, userAttempt, difficulty, context } = request;

  return `I'm practicing English through karaoke and need help with a specific issue.

**Context:**
${context || 'General English practice through song lyrics'}

**Previous Feedback:**
${feedbackContext}

**Current Challenge:**
- Problem type: ${type}
- Target text: "${targetText}"
- My attempt: "${userAttempt}"
- My level: ${difficulty}

As my English coach Scarlett, please create ONE focused exercise to help me improve this specific issue.

**Exercise Types to Choose From:**
1. **say_it_back**: Listen and repeat with pronunciation guidance
2. **fill_in_blank**: Complete the sentence with missing words
3. **multiple_choice**: Choose the correct word/phrase
4. **pronunciation_drill**: Practice specific sounds or syllables

Please create an exercise that:
- Targets my specific error pattern
- Matches my ${difficulty} level
- Includes clear instructions
- Provides helpful hints if needed

Respond in this JSON format:
{
  "id": "exercise_1",
  "type": "say_it_back",
  "instruction": "Listen carefully and repeat this phrase, focusing on the 'th' sound",
  "targetText": "Think about that thing",
  "options": ["option1", "option2", "option3"],
  "correctAnswer": "correct_option",
  "hints": ["helpful hint 1", "helpful hint 2"],
  "difficulty": "intermediate"
}

Notes:
- Only include "options" and "correctAnswer" for multiple_choice type
- Include "hints" for more complex exercises
- Make instructions clear and encouraging`;
}

/**
 * Generate multiple exercises for a complete practice session
 */
export function buildMultipleExercisesPrompt(
  problemAreas: string[],
  difficulty: string,
  songContext: string,
  targetCount: number
): string {
  return `I need a complete practice session to improve my English through karaoke.

**Song Context:**
${songContext}

**Areas I need to work on:**
${problemAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}

**My Level:** ${difficulty}
**Number of exercises needed:** ${targetCount}

As my English coach Scarlett, please create ${targetCount} different exercises that address these problem areas. Make them progressively build on each other.

**Requirements:**
- Mix different exercise types (say_it_back, fill_in_blank, multiple_choice, pronunciation_drill)
- Start easier and gradually increase difficulty
- Each exercise should target one of my problem areas
- Include encouraging instructions
- Provide helpful hints for complex exercises

Respond with a JSON array:
[
  {
    "id": "exercise_1",
    "type": "say_it_back",
    "instruction": "Clear instruction here",
    "targetText": "text to practice",
    "hints": ["hint1", "hint2"],
    "difficulty": "${difficulty}"
  },
  {
    "id": "exercise_2",
    "type": "multiple_choice",
    "instruction": "Choose the correct pronunciation",
    "targetText": "target phrase",
    "options": ["option1", "option2", "option3"],
    "correctAnswer": "option1",
    "difficulty": "${difficulty}"
  }
]

Make each exercise feel connected to the song I was practicing, and keep me motivated!`;
}
