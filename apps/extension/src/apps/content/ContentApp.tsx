import { Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { ExtensionKaraokeView, MinimizedKaraoke } from '@scarlett/ui';
import { trackDetector, type TrackInfo } from '../../services/track-detector';
import { getAuthToken } from '../../utils/storage';
import { browser } from 'wxt/browser';
import { karaokeApi } from '../../services/karaoke-api';

export interface ContentAppProps {}

export const ContentApp: Component<ContentAppProps> = () => {
  console.log('[ContentApp] Rendering ContentApp component');
  
  // State
  const [currentTrack, setCurrentTrack] = createSignal<TrackInfo | null>(null);
  const [authToken, setAuthToken] = createSignal<string | null>(null);
  const [showKaraoke, setShowKaraoke] = createSignal(false);
  const [karaokeData, setKaraokeData] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(false);
  const [sessionStarted, setSessionStarted] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [countdown, setCountdown] = createSignal<number | null>(null);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [audioRef, setAudioRef] = createSignal<HTMLAudioElement | null>(null);
  
  // Load auth token on mount
  onMount(async () => {
    console.log('[ContentApp] Loading auth token');
    const token = await getAuthToken();
    if (token) {
      setAuthToken(token);
      console.log('[ContentApp] Auth token loaded');
    } else {
      // Use demo token for development
      console.log('[ContentApp] No auth token found, using demo token');
      setAuthToken('scarlett_demo_token_123');
    }
    
    // Start watching for track changes
    const cleanup = trackDetector.watchForChanges((track) => {
      console.log('[ContentApp] Track changed:', track);
      setCurrentTrack(track);
      // Show karaoke when track is detected and fetch data
      if (track) {
        setShowKaraoke(true);
        fetchKaraokeData(track);
      }
    });

    onCleanup(cleanup);
  });

  const fetchKaraokeData = async (track: TrackInfo) => {
    console.log('[ContentApp] Fetching karaoke data for track:', track);
    setLoading(true);
    try {
      const data = await karaokeApi.getKaraokeData(
        track.trackId,
        track.title,
        track.artist
      );
      console.log('[ContentApp] Karaoke data loaded:', data);
      setKaraokeData(data);
    } catch (error) {
      console.error('[ContentApp] Failed to fetch karaoke data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    console.log('[ContentApp] Start karaoke session');
    
    // Start countdown
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      const current = countdown();
      if (current !== null && current > 1) {
        setCountdown(current - 1);
      } else {
        clearInterval(countdownInterval);
        setCountdown(null);
        startAudioPlayback();
      }
    }, 1000);
  };

  const startAudioPlayback = () => {
    console.log('[ContentApp] Starting audio playback');
    setIsPlaying(true);
    
    // Get the audio element from the page
    const audioElements = document.querySelectorAll('audio');
    if (audioElements.length > 0) {
      const audio = audioElements[0] as HTMLAudioElement;
      setAudioRef(audio);
      
      // Play the audio
      audio.play().catch(err => {
        console.error('[ContentApp] Failed to play audio:', err);
      });
      
      // Update current time
      const updateTime = () => {
        setCurrentTime(audio.currentTime);
      };
      
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        audio.removeEventListener('timeupdate', updateTime);
      });
    }
  };

  const handleClose = () => {
    setShowKaraoke(false);
    setKaraokeData(null);
    setSessionStarted(false);
  };

  const handleMinimize = () => {
    console.log('[ContentApp] Minimize karaoke widget');
    setIsMinimized(true);
  };

  const handleRestore = () => {
    console.log('[ContentApp] Restore karaoke widget');
    setIsMinimized(false);
  };

  console.log('[ContentApp] Render state:', {
    showKaraoke: showKaraoke(),
    currentTrack: currentTrack(),
    karaokeData: karaokeData(),
    loading: loading()
  });

  const handleComplete = (results: any) => {
    console.log('[ContentApp] Karaoke session completed:', results);
    setSessionStarted(false);
    // TODO: Show results screen
  };

  return (
    <>
      {/* Minimized state */}
      <Show when={showKaraoke() && currentTrack() && isMinimized()}>
        <MinimizedKaraoke onClick={handleRestore} />
      </Show>

      {/* Full widget state */}
      <Show when={showKaraoke() && currentTrack() && !isMinimized()} fallback={
        <div style={{ display: 'none' }}>
          {console.log('[ContentApp] Not showing - showKaraoke:', showKaraoke(), 'currentTrack:', currentTrack())}
        </div>
      }>
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          bottom: '20px',
          width: '480px',
          'z-index': '99999',
          overflow: 'hidden',
          'border-radius': '16px',
          'box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          'flex-direction': 'column'
        }}>
          {console.log('[ContentApp] Rendering ExtensionKaraokeView with data:', karaokeData())}
          <div class="h-full bg-surface rounded-2xl overflow-hidden flex flex-col">
            {/* Header with minimize button */}
            <div class="flex items-center justify-end p-2 bg-surface border-b border-subtle" style={{ height: '48px' }}>
              <button
                onClick={handleMinimize}
                class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ color: '#a8a8a8' }}
                aria-label="Minimize"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 12h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            
            {/* Karaoke View */}
            <div class="flex-1 min-h-0 overflow-hidden">
              <Show when={!loading()} fallback={
                <div class="flex items-center justify-center h-full bg-base">
                  <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
                    <p class="text-secondary">Loading lyrics...</p>
                  </div>
                </div>
              }>
                <Show when={karaokeData()?.lyrics?.lines} fallback={
                  <div class="flex items-center justify-center h-full p-8">
                    <div class="text-center">
                      <p class="text-lg text-secondary mb-2">No lyrics available</p>
                      <p class="text-sm text-tertiary">Try a different song</p>
                    </div>
                  </div>
                }>
                  <div class="h-full flex flex-col">
                    <div class="flex-1 min-h-0 overflow-hidden">
                      <ExtensionKaraokeView
                        score={0}
                        rank={1}
                        lyrics={karaokeData()?.lyrics?.lines || []}
                        currentTime={currentTime() * 1000} // Convert to milliseconds
                        leaderboard={[]}
                        isPlaying={isPlaying() || countdown() !== null}
                        onStart={handleStart}
                        onSpeedChange={(speed) => console.log('[ContentApp] Speed changed:', speed)}
                      />
                    </div>
                    
                    {/* Countdown overlay */}
                    <Show when={countdown() !== null}>
                      <div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div class="text-center">
                          <div class="text-8xl font-bold text-white animate-pulse">
                            {countdown()}
                          </div>
                          <p class="text-xl text-white/80 mt-4">Get ready!</p>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};