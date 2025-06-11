import { Component, createSignal, onMount, Show } from 'solid-js';
import { sdk } from '@farcaster/frame-sdk';
import { FarcasterMiniApp } from '@scarlett/ui';
import type { FrameContext } from '@farcaster/frame-sdk';

const App: Component = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [context, setContext] = createSignal<FrameContext | null>(null);
  const [credits, setCredits] = createSignal(0);
  const [isWalletConnected, setIsWalletConnected] = createSignal(false);
  const [walletAddress, setWalletAddress] = createSignal<string>();

  onMount(async () => {
    try {
      // Check if we're in a mini app
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      
      if (inMiniApp) {
        // Get context
        setContext(sdk.context);
        
        // TODO: Get user credits from API using Quick Auth
        // For now, use demo credits
        setCredits(100);
        
        // Hide splash screen
        await sdk.actions.ready().catch(console.error);
      } else {
        // Dev mode - simulate context
        console.log('Running in dev mode');
        setCredits(100);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsLoading(false);
    }
  });

  const handleConnectWallet = async () => {
    try {
      // For MVP, just simulate wallet connection
      // TODO: Implement actual wallet connection
      setIsWalletConnected(true);
      setWalletAddress('0x1234567890abcdef1234567890abcdef12345678');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress(undefined);
  };

  const handlePurchaseCredits = async (pack: { credits: number; price: string; currency: string }) => {
    console.log('Purchase pack:', pack);
    // TODO: Implement actual purchase flow
    // For MVP, just add credits
    setCredits(credits() + pack.credits);
  };

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="flex items-center justify-center h-screen bg-base">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
        </div>
      }
    >
      <FarcasterMiniApp
        user={context()?.user}
        userCredits={credits()}
        walletAddress={walletAddress()}
        walletChain="Base"
        isWalletConnected={isWalletConnected()}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onPurchaseCredits={handlePurchaseCredits}
      />
    </Show>
  );
};

export default App;