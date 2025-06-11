import { Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { ExtensionKaraokeView, KaraokeSession } from '@scarlett/ui';
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
    setSessionStarted(true);
  };

  const handleClose = () => {
    setShowKaraoke(false);
    setKaraokeData(null);
    setSessionStarted(false);
  };

  const handleMinimize = () => {
    console.log('[ContentApp] Minimize karaoke widget');
    // For now, just close it
    handleClose();
  };

  console.log('[ContentApp] Render state:', {
    showKaraoke: showKaraoke(),
    currentTrack: currentTrack(),
    karaokeData: karaokeData(),
    loading: loading()
  });

  return (
    <Show when={showKaraoke() && currentTrack()} fallback={
      <div style={{ display: 'none' }}>
        {console.log('[ContentApp] Not showing - showKaraoke:', showKaraoke(), 'currentTrack:', currentTrack())}
      </div>
    }>
      {console.log('[ContentApp] Rendering ExtensionKaraokeView with data:', karaokeData())}
      <ExtensionKaraokeView
        track={currentTrack()!}
        lyrics={karaokeData()?.lyrics}
        loading={loading()}
        onStart={handleStart}
        onClose={handleClose}
        onMinimize={handleMinimize}
      />
    </Show>
  );
};