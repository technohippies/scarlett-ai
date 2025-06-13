import { type Component, createSignal, createResource, createMemo, Show, createEffect } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import { I18nProvider, type LyricLine, SubscriptionSlider } from '@scarlett/ui';
import { FarcasterKaraoke } from '../components/FarcasterKaraoke';
import { apiService } from '../services/api';
import { address, isConnected, connectWallet } from '../services/wallet';
import { Paywall } from '@unlock-protocol/paywall';
import { Web3Service } from '@unlock-protocol/unlock-js';
import sdk from '@farcaster/frame-sdk';
import type { Song } from '@scarlett/ui/components/pages/HomePage';

// Unlock Protocol configuration
const unlockConfig = {
  locks: {
    "0xdeaba71ca5e1c10d83eef91d3d0899607646e963": {
      network: 84532, // Base Sepolia
      name: "Unlimited Karaoke",
      recurringPayments: "forever",
      emailRequired: true
    }
  },
  icon: "https://storage.unlock-protocol.com/4dc13d4b-d59d-46ee-b06f-36ed4974d3fd",
  title: "Unlimited Karaoke",
  referrer: "0xB0dD2a6FAB0180C8b2fc4f144273Cc693d7896Ed",
  skipSelect: true,
  hideSoldOut: false,
  pessimistic: false,
  skipRecipient: true,
  persistentCheckout: false
};

export const SongPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Load song data using resource
  const [songResource] = createResource(async () => {
    // Get the full path from location, excluding the leading slash
    const fullPath = location.pathname.slice(1);
    if (!fullPath) throw new Error('No track ID');
    
    // Parse fullPath to get artist and title
    const parts = fullPath.split('/');
    let artist = '';
    let title = '';
    
    if (parts.length >= 2) {
      // Convert URL format to proper names
      // Special cases
      const artistSpecialCases: Record<string, string> = {
        'kanyewest': 'Kanye West',
        '2pac': '2Pac',
        'beyonce': 'Beyoncé',
        'dualipa': 'Dua Lipa'
      };
      
      if (artistSpecialCases[parts[0].toLowerCase()]) {
        artist = artistSpecialCases[parts[0].toLowerCase()];
      } else {
        // Generic conversion: URL format to proper names
        artist = parts[0]
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      
      title = parts[1]
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Fetch karaoke data with full path
    const data = await apiService.getKaraokeData(fullPath, title, artist);
    
    
    return {
      songData: data,
      song: {
        id: fullPath,
        trackId: fullPath,
        title: data.song?.title || title,
        artist: data.song?.artist || artist,
        artworkUrl: data.song?.artwork_url || data.song?.artwork_large || data.song?.artwork_medium || data.song?.artwork_small
      } as Song
    };
  });
  
  // Subscription state
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);
  const [hasActiveSubscription, setHasActiveSubscription] = createSignal(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(null);

  // Convert karaoke data to LyricLine format
  const lyrics = createMemo<LyricLine[]>(() => {
    const data = songResource()?.songData;
    
    if (!data) {
      return [];
    }
    
    if (data.has_karaoke === false || data.status === 'no_lyrics') {
      return [];
    }
    
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
    navigate('/');
  };
  
  // Handle karaoke start with subscription check
  const handleKaraokeStart = (startSession: () => void) => {
    if (!hasActiveSubscription()) {
      setShowSubscriptionModal(true);
      setPendingAction(() => startSession);
      return;
    }
    
    startSession();
  };
  
  // Handle subscription purchase
  const handleSubscribe = async () => {
    setIsProcessingSubscription(true);
    try {
      const paywall = new Paywall(unlockConfig);
      
      const handleStatus = (e: any) => {
        console.log('Unlock status:', e.detail);
        if (e.detail.state === 'unlocked') {
          setHasActiveSubscription(true);
          setShowSubscriptionModal(false);
          
          window.removeEventListener('unlockProtocol.status', handleStatus);
          
          if (pendingAction()) {
            const action = pendingAction();
            setPendingAction(null);
            if (action) {
              action();
            }
          }
        }
      };
      
      window.addEventListener('unlockProtocol.status', handleStatus);
      
      paywall.loadCheckoutModal();
      
      setTimeout(() => {
        setIsProcessingSubscription(false);
      }, 1000);
      
    } catch (error) {
      console.error('Subscription purchase failed:', error);
      setIsProcessingSubscription(false);
    }
  };
  
  // Handle wallet connection
  const handleConnectWallet = async () => {
    await connectWallet();
  };

  // Check for existing Unlock membership
  const checkUnlockMembership = async () => {
    if (!address()) return;
    
    try {
      const web3Service = new Web3Service({
        84532: { // Base Sepolia
          provider: 'https://rpc.ankr.com/base_sepolia',
        }
      });
      
      const hasKey = await web3Service.getHasValidKey(
        "0xdeaba71ca5e1c10d83eef91d3d0899607646e963",
        address()!,
        84532
      );
      
      setHasActiveSubscription(hasKey);
    } catch (error) {
      console.error('Failed to check membership:', error);
    }
  };

  // Check membership when wallet connects
  createEffect(() => {
    if (isConnected() && address()) {
      checkUnlockMembership();
    }
  });

  // Detect browser language
  const browserLang = navigator.language.toLowerCase();
  const locale = browserLang.startsWith('zh') ? 'zh-CN' : 'en';

  return (
    <I18nProvider defaultLocale={locale}>
      <div style={{ "min-height": "100vh", "background-color": "#0a0a0a", "color": "#ffffff", display: "flex", "flex-direction": "column" }}>
        <div style={{ flex: 1, display: "flex", "flex-direction": "column" }}>
          <Show
            when={!songResource.loading && !songResource.error && songResource()}
            fallback={
              <div style={{
                height: '100vh',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'background-color': 'var(--color-base)'
              }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {songResource.loading ? 'Loading song...' : 'Failed to load song'}
                </p>
              </div>
            }
          >
            {(data) => {
              const artworkUrl = data().songData?.song?.artwork_url || 
                               data().songData?.song?.artwork_large || 
                               data().songData?.song?.artwork_medium || 
                               data().songData?.song?.artwork_small ||
                               data().song.artworkUrl;
              
              
              return (
                <FarcasterKaraoke
                  songUrl={`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/audio/proxy/${data().song.trackId}`}
                  lyrics={lyrics()}
                  trackId={data().song.trackId}
                  title={data().song.title}
                  artist={data().song.artist}
                  artworkUrl={artworkUrl}
                  songCatalogId={data().songData?.song_catalog_id}
                  apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                  onStartCheck={handleKaraokeStart}
                  onBack={handleBack}
                />
              );
            }}
          </Show>
        </div>
        
        <SubscriptionSlider
          isOpen={showSubscriptionModal()}
          hasTrialAvailable={true}
          isConnected={isConnected()}
          walletAddress={address()}
          isProcessing={isProcessingSubscription()}
          onClose={() => setShowSubscriptionModal(false)}
          onSubscribe={handleSubscribe}
          onConnectWallet={handleConnectWallet}
        />
      </div>
    </I18nProvider>
  );
};