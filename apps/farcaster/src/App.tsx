import { createSignal, onMount, Show } from 'solid-js';
import sdk from '@farcaster/frame-sdk';
import { FarcasterKaraokeView, type LyricLine, type LeaderboardEntry } from '@scarlett/ui';

const App = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [, setContext] = createSignal<any>(null);
  const [credits] = createSignal(100);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [score] = createSignal(0);
  const [rank] = createSignal(1);
  
  // Mock data for demo
  const mockLyrics: LyricLine[] = [
    { id: '1', text: "Is this the real life?", startTime: 0, duration: 2000 },
    { id: '2', text: "Is this just fantasy?", startTime: 2000, duration: 2000 },
    { id: '3', text: "Caught in a landslide", startTime: 4000, duration: 2000 },
    { id: '4', text: "No escape from reality", startTime: 6000, duration: 2000 },
    { id: '5', text: "Open your eyes", startTime: 8000, duration: 2000 },
    { id: '6', text: "Look up to the skies and see", startTime: 10000, duration: 2000 },
    { id: '7', text: "I'm just a poor boy", startTime: 12000, duration: 2000 },
    { id: '8', text: "I need no sympathy", startTime: 14000, duration: 2000 },
  ];
  
  const mockLeaderboard: LeaderboardEntry[] = [
    { rank: 1, username: "alice.eth", score: 980 },
    { rank: 2, username: "bob.eth", score: 945 },
    { rank: 3, username: "carol.eth", score: 920 },
    { rank: 4, username: "dave.eth", score: 890 },
    { rank: 5, username: "eve.eth", score: 875 },
  ];
  
  const handleStart = () => {
    console.log('Starting karaoke session');
    setIsPlaying(true);
    // Simulate playback
    let time = 0;
    const interval = setInterval(() => {
      time += 100;
      setCurrentTime(time);
      if (time > 16000) {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, 100);
  };
  const [error, setError] = createSignal<string | null>(null);

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
          <div style={{ height: '100vh', display: 'flex', 'flex-direction': 'column' }}>
            <FarcasterKaraokeView
              songTitle="Bohemian Rhapsody"
              artist="Queen"
              score={score()}
              rank={rank()}
              lyrics={mockLyrics}
              currentTime={currentTime()}
              leaderboard={mockLeaderboard}
              isPlaying={isPlaying()}
              onStart={handleStart}
              onSpeedChange={(speed) => console.log('Speed:', speed)}
              onBack={() => console.log('Back')}
            />
          </div>
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