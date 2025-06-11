import { createSignal, onMount, Show } from 'solid-js';
import { sdk } from '@farcaster/frame-sdk';
import type { FrameContext } from '@farcaster/frame-sdk';

const App = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [context, setContext] = createSignal<FrameContext | null>(null);
  const [credits, setCredits] = createSignal(100);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      console.log('App mounting...');
      
      // Check if we're in a mini app
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      console.log('In mini app:', inMiniApp);
      
      if (inMiniApp) {
        // Get context
        setContext(sdk.context);
        
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
    <div style={{ "min-height": "100vh", "background-color": "#0a0a0a", "color": "#ffffff", "padding": "16px" }}>
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
          <div style={{ "max-width": "400px", "margin": "0 auto" }}>
            <h1 style={{ "font-size": "32px", "font-weight": "bold", "margin-bottom": "16px" }}>Scarlett Karaoke</h1>
            <div style={{ "background-color": "#1a1a1a", "padding": "16px", "border-radius": "8px", "margin-bottom": "16px" }}>
              <p style={{ "color": "#a8a8a8", "margin-bottom": "8px" }}>User: {context()?.user?.username || 'Guest'}</p>
              <p style={{ "color": "#a8a8a8" }}>Credits: {credits()}</p>
            </div>
            <div style={{ "background-color": "#1a1a1a", "padding": "16px", "border-radius": "8px" }}>
              <h2 style={{ "font-size": "20px", "font-weight": "600", "margin-bottom": "8px" }}>Coming Soon</h2>
              <p style={{ "color": "#a8a8a8" }}>
                The full karaoke experience is being built. For now, this is a test interface.
              </p>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default App;