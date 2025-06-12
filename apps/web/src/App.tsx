import { createSignal, onMount, Show, createMemo, createResource } from 'solid-js';
import sdk from '@farcaster/frame-sdk';
import { HomePage, type Song, type LyricLine } from '@scarlett/ui';
import { apiService } from './services/api';
import { FarcasterKaraoke } from './components/FarcasterKaraoke';

const App = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [, setContext] = createSignal<any>(null);
  const [credits] = createSignal(100);
  const [error, setError] = createSignal<string | null>(null);
  
  // Song selection state
  const [selectedSong, setSelectedSong] = createSignal<Song | null>(null);
  const [songData, setSongData] = createSignal<any>(null);
  const [isLoadingSong, setIsLoadingSong] = createSignal(false);

  // Fetch popular songs from the API
  const [popularSongs] = createResource(async () => {
    const response = await fetch('http://localhost:8787/api/songs/popular');
    if (!response.ok) {
      throw new Error('Failed to fetch popular songs');
    }
    
    const data = await response.json();
    
    // Transform the API response to match the Song interface
    return data.data?.map((song: any) => ({
      id: song.id,
      trackId: decodeURIComponent(song.trackId), // Decode the URL-encoded trackId
      title: song.title,
      artist: song.artist
    })) || [];
  });

  // Handle song selection
  const handleSongSelect = async (song: Song) => {
    setIsLoadingSong(true);
    setSelectedSong(song);
    
    try {
      // Fetch karaoke data for the song
      const data = await apiService.getKaraokeData(song.trackId, song.title, song.artist);
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
    const data = songData();
    
    // Check different possible response structures
    if (!data) {
      return [];
    }
    
    // If the API says no karaoke/lyrics available
    if (data.has_karaoke === false || data.status === 'no_lyrics') {
      return [];
    }
    
    // Check for lyrics in different possible locations
    const lyricsData = data.lyrics || data.karaoke_data;
    if (!lyricsData?.lines) {
      return [];
    }
    
    const converted = lyricsData.lines.map((line: any, index: number) => ({
      id: `line-${index}`,
      text: line.text || line.words,
      startTime: (line.timestamp || line.start_time) / 1000, // Convert ms to seconds
      duration: line.duration || 3000
    }));
    return converted;
  });

  const handleBack = () => {
    setSelectedSong(null);
    setSongData(null);
  };

  onMount(async () => {
    try {
      // Check if we're in a mini app
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      
      if (inMiniApp) {
        // Get context
        const frameContext = await sdk.context;
        setContext(frameContext);
        
        // Hide splash screen
        await sdk.actions.ready().catch(console.error);
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
                  <FarcasterKaraoke
                    songUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                    lyrics={lyrics()}
                    trackId={selectedSong()!.trackId}
                    title={selectedSong()!.title}
                    artist={selectedSong()!.artist}
                    songCatalogId={songData()?.song_catalog_id}
                    apiUrl="http://localhost:8787/api"
                  />
                </div>
              </Show>
            }
          >
            <Show 
              when={!popularSongs.loading && !popularSongs.error}
              fallback={
                <div style={{ "text-align": "center", "padding": "50px" }}>
                  {popularSongs.loading ? (
                    <p style={{ "color": "#ffffff" }}>Loading songs...</p>
                  ) : (
                    <p style={{ "color": "#ef4444" }}>Failed to load songs. Please check the server.</p>
                  )}
                </div>
              }
            >
              <HomePage
                songs={popularSongs() || []}
                onSongSelect={handleSongSelect}
              />
            </Show>
          </Show>
          
        </Show>
      </Show>
    </div>
  );
};

export default App;