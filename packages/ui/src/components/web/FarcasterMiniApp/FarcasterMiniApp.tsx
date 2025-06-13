import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import { cn } from '../../../utils/cn';
import { UserProfile } from '../UserProfile';
import { CreditPack } from '../CreditPack';
import { WalletConnect } from '../WalletConnect';
import { FarcasterKaraokeView } from '../../karaoke/FarcasterKaraokeView';
import type { LyricLine } from '../../karaoke/LyricsDisplay';
import type { LeaderboardEntry } from '../../karaoke/LeaderboardPanel';

export interface FarcasterMiniAppProps {
  // User info
  user?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  
  // Wallet
  walletAddress?: string;
  walletChain?: 'Base' | 'Solana';
  isWalletConnected?: boolean;
  
  // Credits
  userCredits?: number;
  
  // Callbacks
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
  onPurchaseCredits?: (pack: { credits: number; price: string; currency: string }) => void;
  onSelectSong?: () => void;
  
  class?: string;
}

export const FarcasterMiniApp: Component<FarcasterMiniAppProps> = (props) => {
  const [showKaraoke, setShowKaraoke] = createSignal(false);
  
  // Mock data for demo
  const mockLyrics: LyricLine[] = [
    { id: '1', text: "Is this the real life?", startTime: 0, duration: 2000 },
    { id: '2', text: "Is this just fantasy?", startTime: 2000, duration: 2000 },
    { id: '3', text: "Caught in a landslide", startTime: 4000, duration: 2000 },
    { id: '4', text: "No escape from reality", startTime: 6000, duration: 2000 },
  ];
  
  const mockLeaderboard: LeaderboardEntry[] = [
    { rank: 1, username: "alice", score: 980 },
    { rank: 2, username: "bob", score: 945 },
    { rank: 3, username: "carol", score: 920 },
  ];

  const creditPacks = [
    { credits: 250, price: '2.50', currency: 'USDC' as const },
    { credits: 500, price: '4.75', currency: 'USDC' as const, discount: 5, recommended: true },
    { credits: 1200, price: '10.00', currency: 'USDC' as const, discount: 16 },
  ];

  return (
    <div class={cn('flex flex-col h-screen bg-base', props.class)}>
      {/* Header with user profile */}
      <div class="bg-surface border-b border-subtle">
        <UserProfile
          fid={props.user?.fid}
          username={props.user?.username}
          displayName={props.user?.displayName}
          pfpUrl={props.user?.pfpUrl}
          credits={props.userCredits || 0}
        />
      </div>
      
      {/* Main content */}
      <div class="flex-1 overflow-auto">
        <Show
          when={showKaraoke()}
          fallback={
            <div class="p-4 space-y-6">
              {/* Hero section */}
              <div class="text-center py-8">
                <h1 class="text-3xl font-bold mb-2">Scarlett Karaoke</h1>
                <p class="text-secondary">
                  Sing your favorite songs and compete with friends!
                </p>
              </div>
              
              {/* Credits check */}
              <Show
                when={props.userCredits && props.userCredits > 0}
                fallback={
                  <div class="space-y-6">
                    {/* Wallet connection */}
                    <WalletConnect
                      address={props.walletAddress}
                      chain={props.walletChain}
                      isConnected={props.isWalletConnected}
                      onConnect={props.onConnectWallet}
                      onDisconnect={props.onDisconnectWallet}
                    />
                    
                    {/* Credit packs */}
                    <Show when={props.isWalletConnected}>
                      <div>
                        <h2 class="text-xl font-semibold mb-4">Purchase Credits</h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {creditPacks.map((pack) => (
                            <CreditPack
                              {...pack}
                              onPurchase={() => props.onPurchaseCredits?.(pack)}
                            />
                          ))}
                        </div>
                      </div>
                    </Show>
                  </div>
                }
              >
                {/* Song selection */}
                <div class="space-y-4">
                  <h2 class="text-xl font-semibold">Select a Song</h2>
                  <button 
                    class="w-full p-4 bg-surface rounded-lg border border-subtle hover:border-accent-primary transition-colors text-left"
                    onClick={() => setShowKaraoke(true)}
                  >
                    <div class="font-semibold">Bohemian Rhapsody</div>
                    <div class="text-sm text-secondary">Queen</div>
                    <div class="text-xs text-tertiary mt-1">Cost: 50 credits</div>
                  </button>
                </div>
              </Show>
            </div>
          }
        >
          <FarcasterKaraokeView
            songTitle="Bohemian Rhapsody"
            artist="Queen"
            score={null}
            rank={null}
            lyrics={mockLyrics}
            currentTime={0}
            leaderboard={mockLeaderboard}
            isPlaying={false}
            onStart={() => console.log('Start karaoke')}
            onSpeedChange={(speed) => console.log('Speed:', speed)}
            onBack={() => setShowKaraoke(false)}
          />
        </Show>
      </div>
    </div>
  );
};