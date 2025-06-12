import { Component } from 'solid-js';
import { PracticeExerciseView } from '@scarlett/ui';

interface PracticeViewProps {
  sessionId?: string;
  onBack: () => void;
}

export const PracticeView: Component<PracticeViewProps> = (props) => {
  return (
    <PracticeExerciseView 
      sessionId={props.sessionId}
      onBack={props.onBack}
      // Extension doesn't use auth yet
      // apiBaseUrl is default localhost:8787
    />
  );
};