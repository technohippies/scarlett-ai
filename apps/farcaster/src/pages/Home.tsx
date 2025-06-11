import { Component, createSignal, Show } from 'solid-js';
import { FarcasterKaraokeView } from '@scarlett/ui';
import type { FrameContext } from '@farcaster/frame-sdk';
import { CreditPacks } from '../components/CreditPacks';
import { UserHeader } from '../components/UserHeader';

interface HomeProps {
  context: FrameContext | null;
}

export const Home: Component<HomeProps> = (props) => {
  const [credits, setCredits] = createSignal(0);
  const [showKaraoke, setShowKaraoke] = createSignal(false);
  
  // Mock data for now - will be replaced with real API calls
  const mockSong = {
    title: "Bohemian Rhapsody",
    artist: "Queen"
  };
  
  const mockLyrics = [
    { text: "Is this the real life?", start: 0, end: 2000 },
    { text: "Is this just fantasy?", start: 2000, end: 4000 },
    { text: "Caught in a landslide", start: 4000, end: 6000 },
    { text: "No escape from reality", start: 6000, end: 8000 },
  ];

  const handlePurchaseCredits = (amount: number) => {
    setCredits(credits() + amount);
  };

  return (
    <div class="flex flex-col h-screen">
      <UserHeader user={props.context?.user} credits={credits()} />
      
      <div class="flex-1 overflow-hidden">
        <Show
          when={credits() > 0 && showKaraoke()}
          fallback={
            <div class="p-4 space-y-6">
              <div class="text-center">
                <h1 class="text-2xl font-bold mb-2">Scarlett Karaoke</h1>
                <p class="text-secondary">
                  {credits() === 0 
                    ? "Purchase credits to start singing!" 
                    : "Ready to sing? Select a song to begin."}
                </p>
              </div>
              
              <Show when={credits() === 0}>
                <CreditPacks onPurchase={handlePurchaseCredits} />
              </Show>
              
              <Show when={credits() > 0}>
                <div class="space-y-4">
                  <button 
                    class="w-full p-4 bg-surface rounded-lg border border-subtle hover:border-accent-primary transition-colors"
                    onClick={() => setShowKaraoke(true)}
                  >
                    <div class="text-left">
                      <div class="font-semibold">{mockSong.title}</div>
                      <div class="text-sm text-secondary">{mockSong.artist}</div>
                    </div>
                  </button>
                </div>
              </Show>
            </div>
          }
        >
          <FarcasterKaraokeView
            song={mockSong}
            scores={{ score: 0, rank: 1 }}
            lyrics={mockLyrics}
            currentTime={0}
            leaderboard={[]}
            isPlaying={false}
            onStart={() => console.log('Start karaoke')}
            onSpeedChange={(speed) => console.log('Speed:', speed)}
          />
        </Show>
      </div>
    </div>
  );
};