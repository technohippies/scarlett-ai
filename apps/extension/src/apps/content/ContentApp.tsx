import { Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { KaraokeSession } from '@scarlett/ui';
import { trackDetector, type TrackInfo } from '../../services/track-detector';
import { getAuthToken } from '../../utils/storage';
import { browser } from 'wxt/browser';

export interface ContentAppProps {}

export const ContentApp: Component<ContentAppProps> = () => {
  console.log('[ContentApp] Rendering ContentApp component');
  
  // State
  const [currentTrack, setCurrentTrack] = createSignal<TrackInfo | null>(null);
  const [authToken, setAuthToken] = createSignal<string | null>(null);
  const [showKaraoke, setShowKaraoke] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  
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
      // Show karaoke when track is detected
      if (track) {
        setShowKaraoke(true);
      }
    });

    onCleanup(cleanup);
  });

  const handleComplete = (results: any) => {
    console.log('[ContentApp] Karaoke session completed:', results);
    // TODO: Show completion screen, save results, etc.
  };

  const handleClose = () => {
    setShowKaraoke(false);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized());
  };

  return (
    <Show when={showKaraoke() && currentTrack() && authToken()}>
      <div 
        class="karaoke-widget"
        style={{
          position: 'fixed',
          top: isMinimized() ? 'auto' : '20px',
          right: '20px',
          bottom: '20px',
          width: isMinimized() ? '80px' : '500px',
          height: isMinimized() ? '80px' : 'auto',
          'z-index': '99999',
          overflow: 'hidden',
          'border-radius': '16px',
          'box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          transition: 'all 0.3s ease',
          background: '#0a0a0a',
        }}
      >
        {/* Header controls */}
        <div 
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            padding: '12px 16px',
            background: '#161616',
            'border-bottom': '1px solid #262626',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
            <span style={{ 'font-size': '20px' }}>🎤</span>
            <Show when={!isMinimized()}>
              <span style={{ color: '#fafafa', 'font-weight': '600' }}>Scarlett</span>
            </Show>
          </div>
          <Show when={!isMinimized()}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleMinimize}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a8a8a8',
                  cursor: 'pointer',
                  padding: '4px',
                  'font-size': '18px',
                }}
                title="Minimize"
              >
                −
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a8a8a8',
                  cursor: 'pointer',
                  padding: '4px',
                  'font-size': '18px',
                }}
                title="Close"
              >
                ×
              </button>
            </div>
          </Show>
        </div>

        {/* Karaoke content */}
        <Show when={!isMinimized()}>
          <div style={{ height: 'calc(100% - 49px)' }}>
            <KaraokeSession
              trackId={currentTrack()!.trackId}
              trackTitle={currentTrack()!.title}
              artist={currentTrack()!.artist}
              authToken={authToken()!}
              onComplete={handleComplete}
            />
          </div>
        </Show>

        {/* Minimized view */}
        <Show when={isMinimized()}>
          <button
            onClick={handleMinimize}
            style={{
              width: '100%',
              height: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
            }}
          >
            <span style={{ 'font-size': '32px' }}>🎤</span>
          </button>
        </Show>
      </div>
    </Show>
  );
};