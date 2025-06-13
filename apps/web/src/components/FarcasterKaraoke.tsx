import type { Component } from 'solid-js';
import { createSignal, onMount, createEffect, Show, Match, Switch } from 'solid-js';
import { 
  FarcasterKaraokeView, 
  CompletionView,
  Countdown, 
  useKaraokeSession, 
  I18nProvider,
  LyricDetailSlider,
  type LyricLine,
  type KaraokeResults
} from '@scarlett/ui';
import { PracticeExercises } from './PracticeExercises';
import { apiService } from '../services/api';
import sdk from '@farcaster/frame-sdk';

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
  const [selectedLyric, setSelectedLyric] = createSignal<{ lyric: LyricLine; index: number } | null>(null);
  const [showLyricDetail, setShowLyricDetail] = createSignal(false);
  const [lyricTranslation, setLyricTranslation] = createSignal<string | undefined>();
  const [lyricAnnotations, setLyricAnnotations] = createSignal<any[] | undefined>();
  const [isLoadingLyricDetail, setIsLoadingLyricDetail] = createSignal(false);
  
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
    onComplete: async (results) => {
      setCompletionData(results);
      setViewState('completion');
      
      // Save performance and update streak
      try {
        // Get user ID
        const frameContext = await sdk.context.catch(() => null);
        const userId = frameContext?.user?.fid 
          ? `farcaster-${frameContext.user.fid}` 
          : 'demo-user';
        
        // Save performance
        const performanceResult = await apiService.savePerformance({
          userId,
          songCatalogId: props.songCatalogId || props.trackId,
          score: results.score,
          accuracy: results.accuracy,
          sessionDurationMs: results.duration,
          linesCompleted: results.linesCompleted,
          totalLines: results.totalLines,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        // Update UI if user achieved #1 or improved streak
        if (performanceResult.streak || performanceResult.hasTopPosition) {
          // Could show a celebration or update the header
          console.log('Performance saved:', performanceResult);
        }
      } catch (error) {
        console.error('Failed to save performance:', error);
      }
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

  // Handle lyric click
  const handleLyricClick = (lyric: LyricLine, index: number) => {
    if (!isPlaying()) {
      setSelectedLyric({ lyric, index });
      setShowLyricDetail(true);
      // Reset previous data
      setLyricTranslation(undefined);
      setLyricAnnotations(undefined);
    }
  };

  // Handle translation request
  const handleTranslate = async (targetLang: 'en' | 'es') => {
    if (!selectedLyric()) return;
    
    setIsLoadingLyricDetail(true);
    try {
      // TODO: Call translation API when available
      // For now, simulate with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock translation
      if (targetLang === 'es') {
        setLyricTranslation('Esta es una traducción de ejemplo');
      } else {
        setLyricTranslation('This is an example translation');
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsLoadingLyricDetail(false);
    }
  };

  // Handle annotation request
  const handleAnnotate = async () => {
    if (!selectedLyric()) return;
    
    setIsLoadingLyricDetail(true);
    try {
      // TODO: Call annotation API when available
      // For now, simulate with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock annotations
      setLyricAnnotations([
        {
          word: 'example',
          meaning: 'a thing characteristic of its kind or illustrating a general rule',
          pronunciation: 'ɪɡˈzɑːmpl'
        }
      ]);
    } catch (error) {
      console.error('Annotation failed:', error);
    } finally {
      setIsLoadingLyricDetail(false);
    }
  };

  // Detect user language
  const getUserLanguage = () => {
    const browserLang = navigator.language.toLowerCase();
    return browserLang;
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
                speed={1.0}
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