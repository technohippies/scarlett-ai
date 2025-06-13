import type { Component } from 'solid-js';
import { createSignal, onMount, createEffect, Show, Match, Switch } from 'solid-js';
import { 
  FarcasterKaraokeView, 
  CompletionView,
  Countdown, 
  useKaraokeSession, 
  I18nProvider,
  type LyricLine,
  type KaraokeResults
} from '@scarlett/ui';
import { PracticeExercises } from './PracticeExercises';

interface FarcasterKaraokeProps {
  songUrl: string;
  lyrics: LyricLine[];
  trackId: string;
  title: string;
  artist: string;
  songCatalogId?: string;
  apiUrl?: string;
  onStartCheck?: (startSession: () => void) => void;
  onBack?: () => void;
}

type ViewState = 'karaoke' | 'completion' | 'practice';

export const FarcasterKaraoke: Component<FarcasterKaraokeProps> = (props) => {
  const [score, setScore] = createSignal<number | null>(null);
  const [rank, setRank] = createSignal<number | null>(null);
  const [viewState, setViewState] = createSignal<ViewState>('karaoke');
  const [completionData, setCompletionData] = createSignal<KaraokeResults | null>(null);
  
  // Construct audio URL based on trackId
  const getAudioUrl = () => {
    // Check if it's a SoundCloud trackId (contains forward slash)
    if (props.trackId.includes('/')) {
      // Use the server's proxy endpoint that handles CORS
      const apiUrl = props.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8787';
      return `${apiUrl}/api/audio/proxy/${props.trackId}`;
    }
    
    // For other tracks, use the provided songUrl or empty
    // Don't use soundhelix as it has CORS issues
    return props.songUrl || '';
  };
  
  const audioUrl = getAudioUrl();
  
  // Create audio element with the actual URL
  const [audio] = createSignal(new Audio());
  
  // Initialize audio element
  onMount(() => {
    const audioElement = audio();
    
    if (audioUrl) {
      // Add error handler first
      audioElement.addEventListener('error', (e) => {
        console.error('[FarcasterKaraoke] Audio error:', {
          error: audioElement.error,
          src: audioElement.src,
          readyState: audioElement.readyState,
          networkState: audioElement.networkState
        });
        
        // Try to handle specific error types
        if (audioElement.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          console.error('[FarcasterKaraoke] Audio format not supported');
        }
      });
      
      // Add loadeddata handler
      audioElement.addEventListener('loadeddata', () => {
        console.log('[FarcasterKaraoke] Audio loaded successfully');
      });
      
      // Set source after handlers are attached
      audioElement.src = audioUrl;
      
      // Don't set crossOrigin for local proxy as it handles CORS
      if (!audioUrl.includes('localhost')) {
        audioElement.crossOrigin = 'anonymous';
      }
      
      // Preload the audio
      audioElement.preload = 'auto';
      
      // Set the audio element in the karaoke session
      setAudioElement(audioElement);
    }
  });
  
  
  const {
    isPlaying,
    currentTime,
    countdown,
    startSession,
    stopSession,
    score: sessionScore,
    lineScores,
    setAudioElement
  } = useKaraokeSession({
    lyrics: props.lyrics,
    audioElement: undefined, // Will be set after mount
    trackId: props.trackId,
    songData: {
      title: props.title,
      artist: props.artist
    },
    songCatalogId: props.songCatalogId,
    apiUrl: props.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8787',
    onComplete: (results) => {
      setCompletionData(results);
      setViewState('completion');
    }
  });

  // Add a function to stop/pause or go back
  const handleStop = () => {
    if (isPlaying()) {
      // If playing, just stop the session
      stopSession();
    } else {
      // If not playing, go back to song list
      props.onBack?.();
    }
  };

  // Handle practice errors navigation
  const handlePracticeErrors = async () => {
    setViewState('practice');
  };

  // Handle retry
  const handleRetry = () => {
    setViewState('karaoke');
    setCompletionData(null);
    setScore(null);
    setRank(null);
    // Reset the audio
    if (audio) {
      audio.currentTime = 0;
    }
  };

  // Handle back from practice
  const handleBackFromPractice = () => {
    setViewState('completion');
  };

  return (
    <div class="relative h-screen overflow-hidden">
      <Switch>
        <Match when={viewState() === 'karaoke'}>
          <FarcasterKaraokeView
            songTitle={props.title}
            artist={props.artist}
            score={(sessionScore() || 0) > 0 ? sessionScore() : null}
            rank={rank()}
            lyrics={props.lyrics}
            currentTime={currentTime()}
            isPlaying={isPlaying() || countdown() !== null}
            onStart={props.onStartCheck ? () => props.onStartCheck!(startSession) : startSession}
            onBack={handleStop}
            leaderboard={[]}
            lineScores={lineScores()}
          />
        </Match>
        
        <Match when={viewState() === 'completion' && completionData()}>
          <I18nProvider>
            <Show when={!completionData()!.isLoading} fallback={
              <div class="flex items-center justify-center h-full bg-base">
                <div class="text-center">
                  <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-primary mx-auto mb-4"></div>
                  <p class="text-lg text-secondary">Calculating your final score...</p>
                  <p class="text-sm text-tertiary mt-2">Analyzing full performance</p>
                </div>
              </div>
            }>
              <CompletionView
                score={completionData()!.score}
                rank={1}
                speed={playbackSpeed()}
                feedbackText={
                  completionData()!.score >= 95 ? "Perfect! You nailed it!" :
                  completionData()!.score >= 85 ? "Excellent performance!" :
                  completionData()!.score >= 70 ? "Great job!" :
                  completionData()!.score >= 50 ? "Good effort!" :
                  "Keep practicing!"
                }
                onPractice={completionData()!.needsWorkLines > 0 ? handlePracticeErrors : undefined}
              />
            </Show>
          </I18nProvider>
        </Match>
        
        <Match when={viewState() === 'practice'}>
          <PracticeExercises
            sessionId={completionData()?.sessionId}
            onBack={handleBackFromPractice}
          />
        </Match>
      </Switch>
      
      {/* Shared countdown component - overlays everything */}
      <Countdown count={countdown()} />
    </div>
  );
};