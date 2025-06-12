// Practice and exercise types

export interface PracticeCard {
  id: string;
  user_id: string;
  target_text: string;
  normalized_text?: string;
  
  // FSRS fields
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: string;
  last_review?: string;
  
  // Performance
  best_score: number;
  average_score: number;
  review_count: number;
  contexts_seen: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface MCQExercise {
  type: 'mcq';
  question: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId: string;
}

export interface ReadAloudExercise {
  type: 'read-aloud';
  prompt: string;
  expectedText: string;
}

export type Exercise = MCQExercise | ReadAloudExercise;

export interface PracticeSession {
  id: string;
  userId: string;
  cardIds: string[];
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  results: PracticeResult[];
}

export interface PracticeResult {
  cardId: string;
  score: number;
  timeSpent: number;
  transcript?: string;
  feedback?: string;
}