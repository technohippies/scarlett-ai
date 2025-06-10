import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { ProgressBar } from '../../common/ProgressBar';
import { PracticeHeader } from '../PracticeHeader';
import { ExerciseFooter } from '../ExerciseFooter';
import { ExerciseTemplate } from '../ExerciseTemplate';
import { SayItBack } from '../SayItBack';
import { cn } from '../../../utils/cn';

export interface Exercise {
  id: string;
  type: 'say-it-back';
  prompt: string;
  audioUrl?: string;
  correctAnswer?: string;
}

export interface PracticeExerciseProps {
  exercises: Exercise[];
  currentIndex: number;
  onExit: () => void;
  onComplete: (results: { exerciseId: string; userResponse: string; isCorrect: boolean }[]) => void;
  onPlayAudio?: (audioUrl?: string) => void;
  class?: string;
}

export const PracticeExercise: Component<PracticeExerciseProps> = (props) => {
  const [isRecording, setIsRecording] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [userTranscript, setUserTranscript] = createSignal('');
  const [isCorrect, setIsCorrect] = createSignal<boolean | undefined>(undefined);
  const [results, setResults] = createSignal<{ exerciseId: string; userResponse: string; isCorrect: boolean }[]>([]);
  const [isPlaying, setIsPlaying] = createSignal(false);
  
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
  
  const handleSubmit = () => {
    const exercise = currentExercise();
    const correct = userTranscript().toLowerCase().trim() === 
                   (exercise.correctAnswer || exercise.prompt).toLowerCase().trim();
    
    setIsCorrect(correct);
    
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
  
  const handlePlayAudio = () => {
    setIsPlaying(true);
    props.onPlayAudio?.(currentExercise().audioUrl);
    // Simulate audio playback
    setTimeout(() => setIsPlaying(false), 2000);
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
            <Show when={exercise().type === 'say-it-back'}>
              <ExerciseTemplate instructionText="Listen and repeat:">
                <SayItBack
                  prompt={exercise().prompt}
                  audioUrl={exercise().audioUrl}
                  isPlaying={isPlaying()}
                  userTranscript={userTranscript()}
                  isCorrect={isCorrect()}
                  onPlayAudio={handlePlayAudio}
                  isRecording={isRecording()}
                  isProcessing={isProcessing()}
                  canSubmit={canSubmit()}
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