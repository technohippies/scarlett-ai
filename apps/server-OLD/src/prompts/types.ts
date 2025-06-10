/**
 * Shared types for Venice AI prompt system
 */

export interface KaraokePerformanceData {
  overallScore: number;
  grade?: string; // Optional - can be calculated from score
  songTitle: string;
  artistName: string;
  lineResults: Array<{
    expected: string;
    spoken: string;
    score: number;
  }>;
  totalLines?: number; // Optional - can be derived from lineResults
  performedLines?: number; // Optional - can be calculated
}

export interface FeedbackResponse {
  encouragement: string;
  message?: string; // New simplified message for TTS
  strengths: string[];
  improvementAreas: string[];
  exerciseCount: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ExerciseRequest {
  type: 'pronunciation' | 'word_order' | 'vocabulary' | 'rhythm';
  targetText: string;
  userAttempt: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  context?: string;
}

export interface GeneratedExercise {
  id: string;
  type:
    | 'say_it_back'
    | 'fill_in_blank'
    | 'multiple_choice'
    | 'pronunciation_drill';
  instruction: string;
  targetText: string;
  options?: string[];
  correctAnswer?: string;
  hints?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}
