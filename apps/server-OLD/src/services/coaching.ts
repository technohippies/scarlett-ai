/**
 * AI Coaching Service
 *
 * Integrates Venice AI with karaoke feedback and exercise generation
 */

import { callVeniceAI } from './venice';
import {
  buildKaraokeFeedbackPrompt,
  buildExerciseGenerationPrompt,
} from '../prompts';
import { buildTutorAnalysisPrompt } from '../prompts/tutor-analysis';
import type {
  KaraokePerformanceData,
  FeedbackResponse,
  ExerciseRequest,
  GeneratedExercise,
} from '../prompts/types';
import type { Env } from '../auth';

// Helper function to get grade from score
function getScoreGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

/**
 * Generate personalized feedback for karaoke performance
 */
export async function generateKaraokeFeedback(
  performance: KaraokePerformanceData,
  env: Env
): Promise<FeedbackResponse> {
  try {
    // Use the new simplified tutor analysis prompt
    const { overallScore, songTitle, artistName, lineResults } = performance;

    const tutorRequest = {
      overallScore,
      grade: performance.grade || getScoreGrade(overallScore),
      songTitle,
      artistName,
      totalLines: performance.totalLines || lineResults.length,
      attemptedLines:
        performance.performedLines ||
        lineResults.filter((l: any) => l.spoken).length,
      incorrectLines: lineResults
        .filter((line: any) => line.score < 80)
        .slice(0, 5),
    };

    const prompt = buildTutorAnalysisPrompt(tutorRequest);
    const { answer } = await callVeniceAI(
      prompt,
      `Karaoke performance analysis for ${songTitle}`,
      env
    );

    // Parse the new simplified JSON response
    const parsed = JSON.parse(answer);
    console.log('[Coaching] Generated feedback:', parsed);

    // Convert to legacy FeedbackResponse format for backward compatibility
    return {
      encouragement: parsed.message,
      message: parsed.message, // Add new field
      strengths: ['Great effort!'], // Simplified
      improvementAreas: [parsed.focusArea],
      exerciseCount:
        parsed.difficulty === 'beginner'
          ? 4
          : parsed.difficulty === 'advanced'
            ? 2
            : 3,
      difficulty: parsed.difficulty,
    };
  } catch (error) {
    console.error('[Coaching] Failed to generate feedback:', error);

    // Fallback response
    return {
      encouragement:
        'Great effort on your karaoke performance! Keep practicing!',
      message: 'Great effort on your karaoke performance! Keep practicing!',
      strengths: ['You showed up and tried!'],
      improvementAreas: ['general pronunciation'],
      exerciseCount: 3,
      difficulty: 'intermediate',
    };
  }
}

/**
 * Generate practice exercise for specific issue
 */
export async function generatePracticeExercise(
  request: ExerciseRequest,
  feedbackContext: string,
  env: Env
): Promise<GeneratedExercise> {
  try {
    const prompt = buildExerciseGenerationPrompt(request, feedbackContext);
    const { answer } = await callVeniceAI(
      prompt,
      `Exercise generation for ${request.type} practice`,
      env
    );

    // Parse JSON response
    const exercise = JSON.parse(answer) as GeneratedExercise;

    console.log('[Coaching] Generated exercise:', exercise);
    return exercise;
  } catch (error) {
    console.error('[Coaching] Failed to generate exercise:', error);

    // Fallback exercise
    return {
      id: 'fallback_1',
      type: 'say_it_back',
      instruction:
        "Let's practice this phrase step by step. Listen and repeat.",
      targetText: request.targetText,
      hints: ['Take your time', 'Focus on clear pronunciation'],
      difficulty: request.difficulty,
    };
  }
}

/**
 * Generate multiple exercises for complete practice session
 */
export async function generatePracticeSession(
  problemAreas: string[],
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  songContext: string,
  targetCount: number,
  env: Env
): Promise<GeneratedExercise[]> {
  try {
    // For now, generate one exercise per problem area
    const exercises: GeneratedExercise[] = [];

    for (let i = 0; i < Math.min(problemAreas.length, targetCount); i++) {
      const area = problemAreas[i];

      const request: ExerciseRequest = {
        type: determineExerciseType(area),
        targetText: `Practice ${area}`,
        userAttempt: '',
        difficulty,
        context: songContext,
      };

      const exercise = await generatePracticeExercise(
        request,
        `Working on: ${area}`,
        env
      );

      exercise.id = `exercise_${i + 1}`;
      exercises.push(exercise);
    }

    console.log(
      `[Coaching] Generated ${exercises.length} exercises for session`
    );
    return exercises;
  } catch (error) {
    console.error('[Coaching] Failed to generate practice session:', error);

    // Fallback session with basic exercises
    return problemAreas.slice(0, targetCount).map((area, i) => ({
      id: `fallback_${i + 1}`,
      type: 'say_it_back',
      instruction: `Let's work on ${area}. Listen and repeat.`,
      targetText: `Practice phrase for ${area}`,
      hints: ['Take your time', 'Focus on accuracy'],
      difficulty,
    }));
  }
}

/**
 * Determine best exercise type for a problem area
 */
function determineExerciseType(problemArea: string): ExerciseRequest['type'] {
  const area = problemArea.toLowerCase();

  if (area.includes('pronunciation') || area.includes('sound')) {
    return 'pronunciation';
  }
  if (area.includes('order') || area.includes('grammar')) {
    return 'word_order';
  }
  if (area.includes('vocabulary') || area.includes('word')) {
    return 'vocabulary';
  }
  return 'pronunciation'; // Default
}
