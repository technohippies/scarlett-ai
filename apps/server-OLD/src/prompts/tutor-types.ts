/**
 * Types for AI tutor prompts and responses
 */

export interface TutorAnalysisRequest {
  overallScore: number;
  grade: string;
  songTitle: string;
  artistName: string;
  incorrectLines: Array<{
    expected: string;
    spoken: string;
    score: number;
  }>;
  totalLines: number;
  attemptedLines: number;
}

export interface TutorAnalysisResponse {
  message: string;
  focusArea: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ExerciseGenerationRequest {
  targetPhrase: string;
  userAttempt: string;
  issueType: 'pronunciation' | 'missing_words' | 'word_order' | 'grammar';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  context: string;
}

export interface GeneratedExercise {
  instruction: string;
  targetPhrase: string;
  hints: string[];
  encouragement: string;
}
