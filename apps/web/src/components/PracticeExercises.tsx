import type { Component } from 'solid-js';
import { createMemo } from 'solid-js';
import { PracticeExerciseView } from '@scarlett/ui';
import { apiService } from '../services/api';

interface PracticeExercisesProps {
  sessionId?: string;
  onBack?: () => void;
}

export const PracticeExercises: Component<PracticeExercisesProps> = (props) => {
  // Get auth token if available
  const authToken = createMemo(() => {
    // For now, we'll use demo token
    // In the future, this could come from Farcaster SDK or stored JWT
    return undefined;
  });

  return (
    <PracticeExerciseView 
      sessionId={props.sessionId}
      onBack={props.onBack || (() => {})}
      authToken={authToken()}
      headerTitle="Practice"
      apiBaseUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
    />
  );
};