import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { ProgressBar } from '../../common/ProgressBar';
import { PracticeHeader } from '../PracticeHeader';
import { ExerciseFooter } from '../ExerciseFooter';
import { ExerciseTemplate } from '../ExerciseTemplate';
import { ReadAloud } from '../ReadAloud';
import { cn } from '../../../utils/cn';
import { soundManager } from '../../../utils/sound';

export interface Exercise {
  id: string;
  type: 'read-aloud';
  prompt: string;
  correctAnswer?: string;
}

export interface PracticeExerciseProps {
  exercises: Exercise[];
  currentIndex: number;
  onExit: () => void;
  onComplete: (results: { exerciseId: string; userResponse: string; isCorrect: boolean }[]) => void;
  class?: string;
}

export const PracticeExercise: Component<PracticeExerciseProps> = (props) => {
  const [isRecording, setIsRecording] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [userTranscript, setUserTranscript] = createSignal('');
  const [, setIsCorrect] = createSignal<boolean | undefined>(undefined);
  const [results, setResults] = createSignal<{ exerciseId: string; userResponse: string; isCorrect: boolean }[]>([]);
  
  const currentExercise = () => props.exercises[props.currentIndex];
  const canSubmit = () => userTranscript().trim().length > 0;
  
  const handleRecord = () => {
    setIsRecording(true);
    setUserTranscript('');
    setIsCorrect(undefined);
    // TODO: Start VAD recording
  };
  
  const handleStop = () => {
    setIsRecording(false);
    setIsProcessing(true);
    // TODO: Stop VAD recording and process
    
    // Simulate processing
    setTimeout(() => {
      setUserTranscript('Hello, how are you today?'); // This would come from STT
      setIsProcessing(false);
    }, 1500);
  };
  
  // Normalize text for comparison (same as server-side)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, '') // Remove punctuation except apostrophes and hyphens
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const handleSubmit = () => {
    const exercise = currentExercise();
    if (!exercise) return;
    
    const normalizedTranscript = normalizeText(userTranscript());
    const normalizedAnswer = normalizeText(exercise.correctAnswer || exercise.prompt);
    const correct = normalizedTranscript === normalizedAnswer;
    
    setIsCorrect(correct);
    
    // Play appropriate sound
    soundManager.play(correct ? 'correct' : 'incorrect');
    
    // Add result
    const newResult = {
      exerciseId: exercise.id,
      userResponse: userTranscript(),
      isCorrect: correct
    };
    setResults([...results(), newResult]);
    
    // Move to next exercise after a delay
    setTimeout(() => {
      if (props.currentIndex < props.exercises.length - 1) {
        // Move to next exercise - this would be handled by parent
        resetExercise();
      } else {
        // Complete practice
        props.onComplete(results());
      }
    }, 1500);
  };
  
  const resetExercise = () => {
    setIsRecording(false);
    setIsProcessing(false);
    setUserTranscript('');
    setIsCorrect(undefined);
  };
  
  
  return (
    <div class={cn('min-h-screen bg-base flex flex-col', props.class)}>
      <ProgressBar 
        current={props.currentIndex + 1} 
        total={props.exercises.length} 
      />
      
      <PracticeHeader 
        title="Practice" 
        onExit={props.onExit} 
      />
      
      <main class="flex-1">
        <Show when={currentExercise()}>
          {(exercise) => (
            <Show when={exercise().type === 'read-aloud'}>
              <ExerciseTemplate instructionText="Read aloud:">
                <ReadAloud
                  prompt={exercise().prompt}
                  userTranscript={userTranscript()}
                />
              </ExerciseTemplate>
            </Show>
          )}
        </Show>
      </main>
      
      <ExerciseFooter
        isRecording={isRecording()}
        isProcessing={isProcessing()}
        canSubmit={canSubmit()}
        onRecord={handleRecord}
        onStop={handleStop}
        onSubmit={handleSubmit}
      />
    </div>
  );
};