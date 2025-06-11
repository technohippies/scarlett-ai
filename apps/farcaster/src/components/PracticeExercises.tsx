import type { Component } from 'solid-js';
import { createResource, Show, createSignal, createEffect } from 'solid-js';
import { 
  ReadAloud, 
  ProgressBar, 
  PracticeHeader, 
  ExerciseTemplate, 
  ExerciseFooter 
} from '@scarlett/ui';

interface Exercise {
  id: string;
  type: 'read_aloud';
  full_line: string;
  focus_words: string[];
  card_ids: string[];
  song_context: {
    title: string;
    artist: string;
    song_id: string;
    line_index: number;
  };
}

interface PracticeExercisesProps {
  sessionId?: string;
  onBack?: () => void;
}

export const PracticeExercises: Component<PracticeExercisesProps> = (props) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = createSignal(0);
  const [isRecording, setIsRecording] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [userTranscript, setUserTranscript] = createSignal('');
  const [currentScore, setCurrentScore] = createSignal<number | null>(null);
  const [mediaRecorder, setMediaRecorder] = createSignal<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = createSignal<Blob[]>([]);
  
  // Fetch exercises from the API
  const [exercises] = createResource(async () => {
    try {
      console.log('[PracticeExercises] Fetching exercises...');
      // Include sessionId if provided to get exercises from this session only
      const url = props.sessionId 
        ? `http://localhost:8787/api/practice/exercises?limit=10&sessionId=${props.sessionId}`
        : 'http://localhost:8787/api/practice/exercises?limit=10';
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PracticeExercises] API error:', response.status, errorText);
        throw new Error('Failed to fetch exercises');
      }
      const data = await response.json();
      console.log('[PracticeExercises] Fetched exercises:', data);
      
      if (data.data && data.data.exercises) {
        return data.data.exercises as Exercise[];
      }
      return [];
    } catch (error) {
      console.error('[PracticeExercises] Failed to fetch:', error);
      return [];
    }
  });

  // Log when exercises load
  createEffect(() => {
    const exerciseList = exercises();
    if (exerciseList && exerciseList.length > 0) {
      console.log('[PracticeExercises] Exercises loaded, count:', exerciseList.length);
    }
  });

  const handleStartRecording = async () => {
    console.log('[PracticeExercises] Starting recording...');
    setUserTranscript('');
    setCurrentScore(null);
    setAudioChunks([]);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        await processRecording(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
    } catch (error) {
      console.error('[PracticeExercises] Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const processRecording = async (blob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Convert to base64 for API
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      // Send to STT API
      const response = await fetch('http://localhost:8787/api/speech-to-text/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioBase64: base64,
          expectedText: currentExercise()?.full_line
        })
      });

      if (response.ok) {
        const result = await response.json();
        setUserTranscript(result.data.transcript);
        
        // Calculate a simple score based on matching words
        const score = calculateScore(currentExercise()?.full_line || '', result.data.transcript);
        setCurrentScore(score);
      }
    } catch (error) {
      console.error('[PracticeExercises] Failed to process recording:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopRecording = () => {
    console.log('[PracticeExercises] Stopping recording...');
    const recorder = mediaRecorder();
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setIsRecording(false);
    }
  };

  const calculateScore = (expected: string, actual: string): number => {
    const expectedWords = expected.toLowerCase().split(/\s+/);
    const actualWords = actual.toLowerCase().split(/\s+/);
    let matches = 0;
    
    for (let i = 0; i < expectedWords.length; i++) {
      if (actualWords[i] === expectedWords[i]) {
        matches++;
      }
    }
    
    return Math.round((matches / expectedWords.length) * 100);
  };

  const handleSubmit = async () => {
    const currentExercise = exercises()?.[currentExerciseIndex()];
    const score = currentScore();
    const chunks = audioChunks();
    const blob = chunks.length > 0 ? new Blob(chunks, { type: 'audio/webm' }) : null;
    
    if (currentExercise && currentExercise.card_ids.length > 0 && blob && score !== null) {
      try {
        // Convert audio to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        // Submit review
        const response = await fetch('http://localhost:8787/api/practice/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: currentExercise.id,
            audioBase64: base64,
            cardScores: currentExercise.card_ids.map(cardId => ({
              cardId,
              score
            }))
          })
        });

        if (response.ok) {
          console.log('[PracticeExercises] Review submitted successfully');
        }
      } catch (error) {
        console.error('[PracticeExercises] Failed to submit review:', error);
      }
    }
    
    // Move to next exercise
    if (currentExerciseIndex() < (exercises()?.length || 0) - 1) {
      setCurrentExerciseIndex(currentExerciseIndex() + 1);
      setUserTranscript('');
      setCurrentScore(null);
      setAudioChunks([]);
    } else {
      // All exercises completed
      props.onBack?.();
    }
  };

  const handleSkip = () => {
    console.log('[PracticeExercises] Skipping exercise');
    
    // Move to next exercise
    if (currentExerciseIndex() < (exercises()?.length || 0) - 1) {
      setCurrentExerciseIndex(currentExerciseIndex() + 1);
      setUserTranscript('');
      setCurrentScore(null);
      setAudioChunks([]);
    } else {
      // All exercises completed
      props.onBack?.();
    }
  };

  const currentExercise = () => exercises()?.[currentExerciseIndex()];

  return (
    <div class="h-full bg-base flex flex-col">
      <Show
        when={!exercises.loading}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
              <p class="text-muted-foreground">Loading exercises...</p>
            </div>
          </div>
        }
      >
        <Show
          when={(exercises() || []).length > 0}
          fallback={
            <div class="flex-1 flex items-center justify-center p-8">
              <div class="text-center max-w-md">
                <p class="text-lg text-muted-foreground mb-4">No practice exercises available yet.</p>
                <p class="text-sm text-muted-foreground">Complete karaoke sessions with errors to generate personalized exercises!</p>
              </div>
            </div>
          }
        >
          <Show when={currentExercise()}>
            {(exercise) => (
              <>
                <ProgressBar 
                  current={currentExerciseIndex() + 1} 
                  total={exercises()?.length || 0} 
                />
                
                <PracticeHeader 
                  title="Practice" 
                  onExit={props.onBack || (() => {})} 
                />
                
                <main class="flex-1">
                  <ExerciseTemplate instructionText="Read aloud:">
                    <ReadAloud
                      prompt={exercise().full_line}
                      userTranscript={userTranscript()}
                    />
                    
                    {/* Score display */}
                    <Show when={currentScore() !== null}>
                      <div class="mt-6 text-center">
                        <p class="text-2xl font-bold">
                          Score: {currentScore()}%
                        </p>
                      </div>
                    </Show>
                  </ExerciseTemplate>
                </main>
                
                <ExerciseFooter
                  isRecording={isRecording()}
                  isProcessing={isProcessing()}
                  canSubmit={userTranscript().trim().length > 0}
                  onRecord={handleStartRecording}
                  onStop={handleStopRecording}
                  onSubmit={handleSubmit}
                />
              </>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
};