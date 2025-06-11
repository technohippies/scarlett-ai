import { createSignal, onMount, Show, createMemo } from 'solid-js';
import sdk from '@farcaster/frame-sdk';
import { HomePage, FarcasterKaraokeView, useKaraokeSession, type Song, type LyricLine } from '@scarlett/ui';
import { apiService } from './services/api';

const App = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [, setContext] = createSignal<any>(null);
  const [credits] = createSignal(100);
  const [error, setError] = createSignal<string | null>(null);
  
  // Song selection state
  const [selectedSong, setSelectedSong] = createSignal<Song | null>(null);
  const [songData, setSongData] = createSignal<any>(null);
  const [isLoadingSong, setIsLoadingSong] = createSignal(false);

  // Popular songs
  const popularSongs: Song[] = [
    { id: '1', trackId: 'youtube:dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley' },
    { id: '2', trackId: 'youtube:W9nZ6u15yis', title: 'Bohemian Rhapsody', artist: 'Queen' },
    { id: '3', trackId: 'youtube:fJ9rUzIMcZQ', title: 'Someone Like You', artist: 'Adele' },
    { id: '4', trackId: 'youtube:7NN3gsSf-Ys', title: 'Shape of You', artist: 'Ed Sheeran' },
    { id: '5', trackId: 'youtube:YQHsXMglC9A', title: 'Hello', artist: 'Adele' },
    { id: '6', trackId: 'youtube:CevxZvSJLk8', title: 'Roar', artist: 'Katy Perry' },
    { id: '7', trackId: 'youtube:hLQl3WQQoQ0', title: 'Someone Like You', artist: 'Adele' },
    { id: '8', trackId: 'youtube:09R8_2nJtjg', title: 'Sugar', artist: 'Maroon 5' },
  ];

  // Handle song selection
  const handleSongSelect = async (song: Song) => {
    setIsLoadingSong(true);
    setSelectedSong(song);
    
    try {
      // Fetch karaoke data for the song
      const data = await apiService.getKaraokeData(song.trackId);
      setSongData(data);
    } catch (error) {
      console.error('Failed to load song:', error);
      setError('Failed to load song data');
      setSelectedSong(null);
    } finally {
      setIsLoadingSong(false);
    }
  };

  // Convert karaoke data to LyricLine format
  const lyrics = createMemo<LyricLine[]>(() => {
    if (!songData()?.lyrics?.lines) return [];
    return songData().lyrics.lines.map((line: any, index: number) => ({
      id: `line-${index}`,
      text: line.text,
      startTime: line.timestamp / 1000, // Convert ms to seconds
      duration: line.duration || 3000
    }));
  });

  // Karaoke session hook
  const {
    isPlaying,
    currentTime,
    score,
    startSession,
    stopSession
  } = useKaraokeSession({
    lyrics: lyrics(),
    onComplete: (results) => {
      console.log('Karaoke completed:', results);
    }
  });

  const handleBack = () => {
    setSelectedSong(null);
    setSongData(null);
    stopSession();
  };

  onMount(async () => {
    try {
      console.log('App mounting...');
      
      // Check if we're in a mini app
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      console.log('In mini app:', inMiniApp);
      
      if (inMiniApp) {
        // Get context
        const frameContext = await sdk.context;
        setContext(frameContext);
        
        // Hide splash screen
        await sdk.actions.ready().catch(console.error);
      } else {
        // Dev mode - simulate context
        console.log('Running in dev mode');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setError(String(error));
      setIsLoading(false);
    }
  });

  return (
    <div style={{ "min-height": "100vh", "background-color": "#0a0a0a", "color": "#ffffff" }}>
      <Show
        when={!isLoading()}
        fallback={
          <div style={{ "text-align": "center", "padding": "50px" }}>
            <p style={{ "color": "#ffffff" }}>Loading...</p>
          </div>
        }
      >
        <Show
          when={!error()}
          fallback={
            <div style={{ "text-align": "center", "color": "#ef4444" }}>
              <h1 style={{ "font-size": "24px", "font-weight": "bold" }}>Error</h1>
              <p>{error()}</p>
            </div>
          }
        >
          <Show
            when={!selectedSong()}
            fallback={
              <Show
                when={!isLoadingSong()}
                fallback={
                  <div style={{
                    height: '100vh',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'background-color': 'var(--color-base)'
                  }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Loading song...</p>
                  </div>
                }
              >
                <div style={{ height: '100vh', display: 'flex', 'flex-direction': 'column' }}>
                  <FarcasterKaraokeView
                    songTitle={selectedSong()!.title}
                    artist={selectedSong()!.artist}
                    score={score()}
                    rank={1}
                    lyrics={lyrics()}
                    currentTime={currentTime()}
                    leaderboard={[]}
                    isPlaying={isPlaying()}
                    onStart={startSession}
                    onSpeedChange={(speed) => console.log('Speed:', speed)}
                    onBack={handleBack}
                  />
                </div>
              </Show>
            }
          >
            <HomePage
              songs={popularSongs}
              onSongSelect={handleSongSelect}
            />
          </Show>
          
          {/* Credits display */}
          <div style={{ 
            position: 'absolute', 
            top: '8px', 
            right: '8px',
            padding: '4px 8px',
            "background-color": "rgba(26, 26, 26, 0.8)",
            "border-radius": "4px",
            "font-size": "14px"
          }}>
            Credits: {credits()}
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default App;