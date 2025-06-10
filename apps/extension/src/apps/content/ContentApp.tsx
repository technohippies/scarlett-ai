import { Component, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { ExtensionKaraokeView } from '@scarlett/ui';
import { karaokeApi, type KaraokeData, type LyricLine } from '../../services/karaoke-api';
import { trackDetector, type TrackInfo } from '../../services/track-detector';

export interface ContentAppProps {
  // Add any props needed for communication with the page
}

export const ContentApp: Component<ContentAppProps> = () => {
  console.log('[ContentApp] Rendering ContentApp component');
  
  // State
  const [currentTrack, setCurrentTrack] = createSignal<TrackInfo | null>(null);
  const [karaokeData, setKaraokeData] = createSignal<KaraokeData | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Mock leaderboard data (TODO: fetch real leaderboard)
  const mockLeaderboard = [
    { rank: 1, username: 'KaraokeKing', score: 12500 },
    { rank: 2, username: 'SongBird92', score: 11200 },
    { rank: 3, username: 'MelodyMaster', score: 10800 },
    { rank: 4, username: 'CurrentUser', score: 8750, isCurrentUser: true },
    { rank: 5, username: 'VocalVirtuoso', score: 8200 },
  ];

  // Fetch karaoke data when track changes
  createEffect(async () => {
    const track = currentTrack();
    if (!track) {
      setKaraokeData(null);
      return;
    }

    console.log('[ContentApp] Fetching karaoke data for track:', track);
    setIsLoading(true);
    setError(null);

    try {
      const data = await karaokeApi.getKaraokeData(
        track.trackId,
        track.title,
        track.artist
      );

      if (data && (data.hasKaraoke || data.has_karaoke)) {
        setKaraokeData(data);
        console.log('[ContentApp] Karaoke data loaded:', data);
      } else if (data?.api_connected) {
        setError(`API Connected! ${data.error || 'Database setup needed'}`);
        setKaraokeData(data);
      } else {
        setError(data?.message || data?.error || 'No karaoke data available for this track');
        setKaraokeData(null);
      }
    } catch (err) {
      console.error('[ContentApp] Error fetching karaoke data:', err);
      setError('Failed to load karaoke data');
      setKaraokeData(null);
    } finally {
      setIsLoading(false);
    }
  });

  // Set up track detection
  onMount(() => {
    console.log('[ContentApp] Setting up track detection');
    
    // Start watching for track changes
    const cleanup = trackDetector.watchForChanges((track) => {
      console.log('[ContentApp] Track changed:', track);
      setCurrentTrack(track);
    });

    onCleanup(cleanup);
  });

  // Convert server lyrics format to component format
  const getLyrics = (): LyricLine[] => {
    const data = karaokeData();
    if (!data?.lyrics?.lines) return [];

    return data.lyrics.lines.map((line, index) => ({
      id: line.id || `line-${index}`,
      text: line.text,
      startTime: line.startTime,
      duration: line.duration,
    }));
  };

  // Prepare props for ExtensionKaraokeView
  const getViewProps = () => {
    const data = karaokeData();
    const track = currentTrack();
    
    if (isLoading()) {
      return {
        score: 0,
        rank: 0,
        lyrics: [{ id: 'loading', text: 'Loading lyrics...', startTime: 0, duration: 3 }],
        leaderboard: [],
        currentTime: 0,
        isPlaying: false,
        onStart: () => console.log('Loading...'),
        onSpeedChange: () => {},
      };
    }

    if (error() || !(data?.hasKaraoke || data?.has_karaoke)) {
      const errorMessage = error() || 'No karaoke available for this track';
      const isApiConnected = errorMessage.includes('Cannot read properties') || errorMessage.includes('prepare');
      
      return {
        score: 0,
        rank: 0,
        lyrics: [{ 
          id: 'error', 
          text: isApiConnected 
            ? `✅ API Connected! Server needs database setup. Track: ${track?.title}` 
            : errorMessage, 
          startTime: 0, 
          duration: 8 
        }],
        leaderboard: [],
        currentTime: 0,
        isPlaying: false,
        onStart: () => console.log('API connection test successful'),
        onSpeedChange: () => {},
      };
    }

    return {
      score: 8750, // TODO: Get real user score
      rank: 4, // TODO: Get real user rank
      lyrics: getLyrics(),
      leaderboard: mockLeaderboard,
      currentTime: 0, // TODO: Sync with video/audio playback
      isPlaying: false, // TODO: Detect if video/audio is playing
      onStart: () => {
        console.log('Start karaoke for:', track?.title);
        // TODO: Start karaoke session
      },
      onSpeedChange: (speed: number) => {
        console.log('Speed changed to:', speed);
        // TODO: Implement playback speed control
      },
    };
  };

  return (
    <div class="karaoke-widget bg-base h-full overflow-hidden rounded-lg">
      <ExtensionKaraokeView {...getViewProps()} />
    </div>
  );
};