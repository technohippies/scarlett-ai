import type { Component } from 'solid-js';
import { createResource, Show, createSignal, createEffect } from 'solid-js';
import { ReadAloud } from '../ReadAloud';
import { ProgressBar } from '../../common/ProgressBar';
import { PracticeHeader } from '../PracticeHeader';
import { ExerciseTemplate } from '../ExerciseTemplate';
import { ExerciseFooter } from '../ExerciseFooter';
import { ResponseFooter } from '../ResponseFooter';
import type { ReadAloudExercise as Exercise } from '@scarlett/core';
import { soundManager } from '../../../utils/sound';

export interface PracticeExerciseViewProps {
  sessionId?: string;
  onBack: () => void;
  apiBaseUrl?: string;
  authToken?: string;
  headerTitle?: string;
}

export const PracticeExerciseView: Component<PracticeExerciseViewProps> = (props) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = createSignal(0);
  const [isRecording, setIsRecording] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [userTranscript, setUserTranscript] = createSignal('');
  const [currentScore, setCurrentScore] = createSignal<number | null>(null);
  const [mediaRecorder, setMediaRecorder] = createSignal<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = createSignal<Blob[]>([]);
  const [showFeedback, setShowFeedback] = createSignal(false);
  const [isCorrect, setIsCorrect] = createSignal(false);
  
  const apiBaseUrl = () => props.apiBaseUrl || 'http://localhost:8787';
  
  // Fetch exercises from the API
  const [exercises] = createResource(async () => {
    try {
      // Include sessionId if provided to get exercises from this session only
      const url = props.sessionId 
        ? `${apiBaseUrl()}/api/practice/exercises?limit=10&sessionId=${props.sessionId}`
        : `${apiBaseUrl()}/api/practice/exercises?limit=10`;
      
      const headers: HeadersInit = {};
      if (props.authToken) {
        headers['Authorization'] = `Bearer ${props.authToken}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PracticeExerciseView] API error:', response.status, errorText);
        throw new Error('Failed to fetch exercises');
      }
      const data = await response.json();
      
      if (data.data && data.data.exercises) {
        return data.data.exercises as Exercise[];
      }
      return [];
    } catch (error) {
      console.error('[PracticeExerciseView] Failed to fetch:', error);
      return [];
    }
  });

  // Log when exercises load
  createEffect(() => {
    const exerciseList = exercises();
  });

  const handleStartRecording = async () => {
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
      console.error('[PracticeExerciseView] Failed to start recording:', error);
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

      // Send to STT API with retry logic
      let response;
      let attempts = 0;
      const maxAttempts = 2;
      
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (props.authToken) {
        headers['Authorization'] = `Bearer ${props.authToken}`;
      }
      
      while (attempts < maxAttempts) {
        try {
          response = await fetch(`${apiBaseUrl()}/api/speech-to-text/transcribe`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
              audioBase64: base64,
              expectedText: currentExercise()?.full_line,
              // Use Deepgram on retry
              preferDeepgram: attempts > 0
            })
          });
          
          if (response.ok) {
            break;
          }
        } catch (fetchError) {
          console.error(`[PracticeExerciseView] STT attempt ${attempts + 1} failed:`, fetchError);
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before retry
        }
      }

      if (response && response.ok) {
        const result = await response.json();
        setUserTranscript(result.data.transcript);
        
        // Calculate a simple score based on matching words
        const score = calculateScore(currentExercise()?.full_line || '', result.data.transcript);
        setCurrentScore(score);
        
        // Automatically submit after transcription
        await handleAutoSubmit(score);
      } else {
        throw new Error('STT failed after retries');
      }
    } catch (error) {
      console.error('[PracticeExerciseView] Failed to process recording:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorder();
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setIsRecording(false);
    }
  };

  // Normalize text for comparison (same as server-side)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, '') // Remove punctuation except apostrophes and hyphens
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const calculateScore = (expected: string, actual: string): number => {
    const normalizedExpected = normalizeText(expected);
    const normalizedActual = normalizeText(actual);
    
    // If they're exactly the same after normalization, it's 100%
    if (normalizedExpected === normalizedActual) {
      return 100;
    }
    
    // Otherwise, do word-by-word comparison
    const expectedWords = normalizedExpected.split(/\s+/);
    const actualWords = normalizedActual.split(/\s+/);
    let matches = 0;
    
    for (let i = 0; i < expectedWords.length; i++) {
      if (actualWords[i] === expectedWords[i]) {
        matches++;
      }
    }
    
    return Math.round((matches / expectedWords.length) * 100);
  };

  const handleAutoSubmit = async (score: number) => {
    const currentExercise = exercises()?.[currentExerciseIndex()];
    const chunks = audioChunks();
    const blob = chunks.length > 0 ? new Blob(chunks, { type: 'audio/webm' }) : null;
    
    // Determine if correct (100% after normalization)
    setIsCorrect(score === 100);
    setShowFeedback(true);
    
    // Play appropriate sound
    soundManager.play(score === 100 ? 'correct' : 'incorrect');
    
    if (currentExercise && currentExercise.card_ids.length > 0 && blob) {
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

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (props.authToken) {
          headers['Authorization'] = `Bearer ${props.authToken}`;
        }

        // Submit review
        const response = await fetch(`${apiBaseUrl()}/api/practice/review`, {
          method: 'POST',
          headers,
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
        }
      } catch (error) {
        console.error('[PracticeExerciseView] Failed to submit review:', error);
      }
    }
  };
  
  const handleSubmit = async () => {
    // This is now only used as fallback if needed
    const score = currentScore();
    if (score !== null) {
      await handleAutoSubmit(score);
    }
  };
  
  const handleContinue = () => {
    // Move to next exercise
    if (currentExerciseIndex() < (exercises()?.length || 0) - 1) {
      setCurrentExerciseIndex(currentExerciseIndex() + 1);
      setUserTranscript('');
      setCurrentScore(null);
      setAudioChunks([]);
      setShowFeedback(false);
      setIsCorrect(false);
    } else {
      // All exercises completed
      props.onBack();
    }
  };

  const handleSkip = () => {
    
    // Move to next exercise
    if (currentExerciseIndex() < (exercises()?.length || 0) - 1) {
      setCurrentExerciseIndex(currentExerciseIndex() + 1);
      setUserTranscript('');
      setCurrentScore(null);
      setAudioChunks([]);
    } else {
      // All exercises completed
      props.onBack();
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
                  title={props.headerTitle || ""} 
                  onExit={props.onBack} 
                />
                
                <main class="flex-1">
                  <ExerciseTemplate instructionText="Read aloud:">
                    <ReadAloud
                      prompt={exercise().full_line}
                      userTranscript={userTranscript()}
                    />
                  </ExerciseTemplate>
                </main>
                
                <Show
                  when={showFeedback()}
                  fallback={
                    <ExerciseFooter
                      isRecording={isRecording()}
                      isProcessing={isProcessing()}
                      canSubmit={userTranscript().trim().length > 0}
                      onRecord={handleStartRecording}
                      onStop={handleStopRecording}
                      onSubmit={handleSubmit}
                    />
                  }
                >
                  <ResponseFooter
                    mode="feedback"
                    isCorrect={isCorrect()}
                    onContinue={handleContinue}
                  />
                </Show>
              </>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
};