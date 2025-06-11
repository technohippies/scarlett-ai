import { Hono } from 'hono';
import type { Env } from '../types';
import { createVeniceService } from '../services/venice.service';

interface ExerciseGenerationRequest {
  errors: Array<{
    expected: string;
    actual: string;
    score: number;
  }>;
  songInfo?: {
    title: string;
    artist: string;
  };
}

interface MCQExercise {
  type: 'mcq';
  question: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId: string;
}

interface ReadAloudExercise {
  type: 'read-aloud';
  prompt: string;
  expectedText: string;
}

type Exercise = MCQExercise | ReadAloudExercise;

export const exercisesRoutes = new Hono<{ Bindings: Env }>();

exercisesRoutes.post('/generate', async (c) => {
  try {
    const { errors, songInfo } = await c.req.json<ExerciseGenerationRequest>();
    
    if (!errors || errors.length === 0) {
      return c.json({ error: 'No errors provided' }, 400);
    }

    const veniceService = createVeniceService(c.env);
    if (!veniceService) {
      return c.json({ error: 'Venice service not configured' }, 503);
    }

    // Filter out likely STT errors vs real pronunciation issues
    const realErrors = errors.filter(error => {
      // If score is above 70, it's likely an STT confusion
      if (error.score > 70) return false;
      
      // Check for repeated sounds that might be STT artifacts
      const repeatedPattern = /(\w)\1{2,}/; // e.g., "nnn" or "ttt"
      if (repeatedPattern.test(error.actual)) return false;
      
      // Check if it's a known slang vs proper word issue
      const slangMappings = [
        { slang: "hurtin'", proper: "hurting" },
        { slang: "somethin'", proper: "something" },
        { slang: "nothin'", proper: "nothing" },
        { slang: "'cause", proper: "because" },
        { slang: "gonna", proper: "going to" },
        { slang: "wanna", proper: "want to" },
        { slang: "gotta", proper: "got to" },
      ];
      
      const isSlangVariation = slangMappings.some(mapping => 
        (error.expected.toLowerCase().includes(mapping.slang) && 
         error.actual.toLowerCase().includes(mapping.proper)) ||
        (error.expected.toLowerCase().includes(mapping.proper) && 
         error.actual.toLowerCase().includes(mapping.slang))
      );
      
      if (isSlangVariation && error.score > 50) return false;
      
      return true;
    });

    if (realErrors.length === 0) {
      return c.json({ 
        exercises: [],
        message: 'Great job! No significant pronunciation errors detected.' 
      });
    }

    // Generate exercises using Venice AI
    const systemPrompt = `You are a language learning assistant specializing in pronunciation practice through music. 
Your task is to create engaging exercises based on specific pronunciation errors from a karaoke session.

Rules:
1. Create 2-3 exercises maximum
2. Focus on the most significant errors (lowest scores)
3. Make exercises fun and music-related when possible
4. For MCQ: Create 4 options where 3 are common mispronunciations
5. For Read-Aloud: Use the exact problematic phrase in a new context
6. Keep language simple and encouraging

Output format must be valid JSON array of exercises.`;

    const userPrompt = `Create pronunciation exercises for these errors from ${songInfo ? `"${songInfo.title}" by ${songInfo.artist}` : 'a karaoke session'}:

${realErrors.slice(0, 3).map((error, i) => `
Error ${i + 1}:
- Expected: "${error.expected}"
- User said: "${error.actual}"
- Score: ${error.score}%
`).join('\n')}

Return a JSON array with 2-3 exercises. Each exercise should be either:
1. MCQ format: { "type": "mcq", "question": "...", "options": [{"id": "a", "text": "..."}, ...], "correctOptionId": "..." }
2. Read-aloud format: { "type": "read-aloud", "prompt": "Read this phrase aloud:", "expectedText": "..." }`;

    const response = await veniceService.complete(userPrompt, systemPrompt);
    
    // Parse the response
    let exercises: Exercise[];
    try {
      // Extract JSON from the response (Venice might include markdown)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      exercises = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[Exercises] Failed to parse Venice response:', parseError);
      console.error('[Exercises] Raw response:', response);
      
      // Fallback: create simple exercises manually
      exercises = realErrors.slice(0, 2).map((error, i) => ({
        type: 'read-aloud' as const,
        prompt: `Practice saying this phrase clearly:`,
        expectedText: error.expected
      }));
    }

    return c.json({ 
      exercises,
      processedErrors: realErrors.length,
      totalErrors: errors.length
    });

  } catch (error) {
    console.error('[Exercises] Error generating exercises:', error);
    return c.json({ error: 'Failed to generate exercises' }, 500);
  }
});

// Endpoint to validate exercise completion
exercisesRoutes.post('/validate', async (c) => {
  try {
    const { exercise, userResponse } = await c.req.json();
    
    if (exercise.type === 'mcq') {
      const isCorrect = userResponse === exercise.correctOptionId;
      return c.json({ 
        correct: isCorrect,
        feedback: isCorrect ? 'Correct!' : `The correct answer was: ${exercise.options.find((o: any) => o.id === exercise.correctOptionId)?.text}`
      });
    }
    
    if (exercise.type === 'read-aloud') {
      // For read-aloud, we'd integrate with STT service
      // For now, just return success
      return c.json({ 
        correct: true,
        feedback: 'Good job! Keep practicing for even better pronunciation.'
      });
    }
    
    return c.json({ error: 'Invalid exercise type' }, 400);
    
  } catch (error) {
    console.error('[Exercises] Error validating exercise:', error);
    return c.json({ error: 'Failed to validate exercise' }, 500);
  }
});