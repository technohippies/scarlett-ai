import { Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { ExtensionKaraokeView, MinimizedKaraoke, Countdown, CompletionView, useKaraokeSession, ExtensionAudioService, I18nProvider, type PlaybackSpeed } from '@scarlett/ui';
import { trackDetector, type TrackInfo } from '../../services/track-detector';
import { getAuthToken } from '../../utils/storage';
import { browser } from 'wxt/browser';
import { karaokeApi } from '../../services/karaoke-api';
import { PracticeView } from './PracticeView';

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
  const [karaokeSession, setKaraokeSession] = createSignal<ReturnType<typeof useKaraokeSession> | null>(null);
  const [completionData, setCompletionData] = createSignal<any>(null);
  const [showPractice, setShowPractice] = createSignal(false);
  const [selectedSpeed, setSelectedSpeed] = createSignal<PlaybackSpeed>('1x');
  
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

  const handleStart = async () => {
    console.log('[ContentApp] Start karaoke session');
    setSessionStarted(true);
    
    const data = karaokeData();
    const audio = audioRef();
    const track = currentTrack();
    
    if (data && track && data.lyrics?.lines) {
      console.log('[ContentApp] Creating karaoke session with audio capture', {
        trackId: track.id,
        trackTitle: track.title,
        songData: data.song,
        hasLyrics: !!data.lyrics?.lines
      });
      
      // Create and start session
      const newSession = useKaraokeSession({
        lyrics: data.lyrics.lines,
        trackId: track.trackId,
        songData: data.song ? {
          title: data.song.title,
          artist: data.song.artist,
          album: data.song.album,
          duration: data.song.duration
        } : {
          title: track.title,
          artist: track.artist
        },
        songCatalogId: data.song_catalog_id,
        audioElement: undefined, // Will be set when audio starts playing
        apiUrl: 'http://localhost:8787/api',
        onComplete: (results) => {
          console.log('[ContentApp] Karaoke session completed:', results);
          setSessionStarted(false);
          setIsPlaying(false);
          setCompletionData(results);
          
          // Stop audio playback
          const audio = audioRef();
          if (audio) {
            audio.pause();
          }
        }
      });
      
      // Apply the selected speed to the new session
      console.log('[ContentApp] Applying selected speed to new session:', selectedSpeed());
      newSession.handleSpeedChange(selectedSpeed());
      
      setKaraokeSession(newSession);
      
      // Start the session (includes countdown and audio initialization)
      await newSession.startSession();
      
      // Watch for countdown to finish and start audio
      createEffect(() => {
        if (newSession.countdown() === null && newSession.isPlaying() && !isPlaying()) {
          console.log('[ContentApp] Countdown finished, starting audio playback');
          startAudioPlayback();
        }
        
        // Update session with audio element when available
        const audio = audioRef();
        if (audio && newSession) {
          console.log('[ContentApp] Setting audio element on new session');
          newSession.setAudioElement(audio);
        }
      });
    } else {
      console.log('[ContentApp] Fallback to simple countdown');
      // Fallback to old behavior
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
    }
  };

  const startAudioPlayback = () => {
    console.log('[ContentApp] Starting audio playback');
    setIsPlaying(true);
    
    // Try multiple methods to find and play audio
    // Method 1: Look for audio elements
    const audioElements = document.querySelectorAll('audio');
    console.log('[ContentApp] Found audio elements:', audioElements.length);
    
    if (audioElements.length > 0) {
      const audio = audioElements[0] as HTMLAudioElement;
      console.log('[ContentApp] Audio element:', {
        src: audio.src,
        paused: audio.paused,
        duration: audio.duration,
        currentTime: audio.currentTime
      });
      setAudioRef(audio);
      
      // Update karaoke session with audio element if it exists
      const session = karaokeSession();
      if (session) {
        console.log('[ContentApp] Setting audio element on karaoke session');
        session.setAudioElement(audio);
        
        if (!session.audioProcessor.isReady()) {
          console.log('[ContentApp] Initializing audio processor for session');
          session.audioProcessor.initialize().catch(console.error);
        }
      }
      
      // Try to play the audio
      audio.play().then(() => {
        console.log('[ContentApp] Audio started playing successfully');
      }).catch(err => {
        console.error('[ContentApp] Failed to play audio:', err);
        
        // Method 2: Try clicking the play button on the page
        console.log('[ContentApp] Attempting to click play button...');
        const playButton = document.querySelector('button[title*="Play"], button[aria-label*="Play"], .playControl, .playButton, [class*="play-button"]');
        if (playButton) {
          console.log('[ContentApp] Found play button, clicking it');
          (playButton as HTMLElement).click();
        }
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
    } else {
      // Method 3: Try SoundCloud specific selectors
      console.log('[ContentApp] No audio elements found, trying SoundCloud-specific approach');
      const playButton = document.querySelector('.playControl, .sc-button-play, button[title*="Play"]');
      if (playButton) {
        console.log('[ContentApp] Found SoundCloud play button, clicking it');
        (playButton as HTMLElement).click();
        
        // Wait a bit and then look for audio element again
        setTimeout(() => {
          const newAudioElements = document.querySelectorAll('audio');
          if (newAudioElements.length > 0) {
            console.log('[ContentApp] Found audio element after clicking play');
            const audio = newAudioElements[0] as HTMLAudioElement;
            setAudioRef(audio);
            
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
        }, 500);
      }
    }
  };

  const handleClose = () => {
    // Stop session if active
    const session = karaokeSession();
    if (session) {
      session.stopSession();
    }
    
    setShowKaraoke(false);
    setKaraokeData(null);
    setSessionStarted(false);
    setKaraokeSession(null);
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
          {console.log('[ContentApp] Rendering with completion data:', completionData())}
          <div class="h-full bg-surface rounded-2xl overflow-hidden flex flex-col">
            {/* Header with minimize and close buttons */}
            <div class="flex items-center justify-end p-2 bg-surface border-b border-subtle" style={{ height: '48px' }}>
              <div class="flex items-center gap-2">
                <Show when={showPractice()}>
                  <button
                    onClick={() => setShowPractice(false)}
                    class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: '#a8a8a8' }}
                    aria-label="Close Practice"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </Show>
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
            </div>
            
            {/* Main content area */}
            <div class="flex-1 min-h-0 overflow-hidden">
              <Show when={completionData()} fallback={
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
                          score={karaokeSession() ? karaokeSession()!.score() : 0}
                          rank={1}
                          lyrics={karaokeData()?.lyrics?.lines || []}
                          currentTime={karaokeSession() ? karaokeSession()!.currentTime() : currentTime() * 1000}
                          leaderboard={[]}
                          isPlaying={karaokeSession() ? (karaokeSession()!.isPlaying() || karaokeSession()!.countdown() !== null) : (isPlaying() || countdown() !== null)}
                          onStart={handleStart}
                          onSpeedChange={(speed) => {
                            console.log('[ContentApp] Speed changed:', speed);
                            setSelectedSpeed(speed);
                            
                            const session = karaokeSession();
                            if (session) {
                              console.log('[ContentApp] Applying speed change to session');
                              session.handleSpeedChange(speed);
                            } else {
                              console.log('[ContentApp] No session yet, speed will be applied when session starts');
                            }
                            
                            // Also apply to audio element directly if it exists
                            const audio = audioRef();
                            if (audio) {
                              const rate = speed === '0.5x' ? 0.5 : speed === '0.75x' ? 0.75 : 1.0;
                              console.log('[ContentApp] Setting audio playback rate directly to:', rate);
                              audio.playbackRate = rate;
                            }
                          }}
                          isRecording={karaokeSession() ? karaokeSession()!.isRecording() : false}
                          lineScores={karaokeSession() ? karaokeSession()!.lineScores() : []}
                        />
                      </div>
                      
                      {/* Countdown overlay */}
                      <Show when={karaokeSession() ? karaokeSession()!.countdown() !== null : countdown() !== null}>
                        <div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                          <div class="text-center">
                            <div class="text-8xl font-bold text-white animate-pulse">
                              {karaokeSession() ? karaokeSession()!.countdown() : countdown()}
                            </div>
                            <p class="text-xl text-white/80 mt-4">Get ready!</p>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </Show>
              }>
                {/* Completion View or Practice View */}
                <Show when={showPractice()} fallback={
                  <I18nProvider>
                    <div class="h-full flex flex-col">
                      <Show when={!completionData().isLoading} fallback={
                        <div class="flex items-center justify-center h-full bg-base">
                          <div class="text-center">
                            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-primary mx-auto mb-4"></div>
                            <p class="text-lg text-secondary">Calculating your final score...</p>
                            <p class="text-sm text-tertiary mt-2">Analyzing full performance</p>
                          </div>
                        </div>
                      }>
                        <CompletionView
                          class="h-full"
                          score={completionData().score}
                          rank={1}
                          speed={selectedSpeed()}
                          feedbackText={
                            completionData().score >= 95 ? "Perfect! You nailed it!" :
                            completionData().score >= 85 ? "Excellent performance!" :
                            completionData().score >= 70 ? "Great job!" :
                            completionData().score >= 50 ? "Good effort!" :
                            "Keep practicing!"
                          }
                          onPractice={() => {
                            console.log('[ContentApp] Practice errors clicked');
                            setShowPractice(true);
                          }}
                        />
                      </Show>
                    </div>
                  </I18nProvider>
                }>
                  {/* Practice View */}
                  <div class="h-full overflow-y-auto">
                    <PracticeView
                      sessionId={completionData()?.sessionId}
                      onBack={() => setShowPractice(false)}
                    />
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