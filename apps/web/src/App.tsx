import { createSignal, onMount, Show, createMemo, createResource, createEffect } from 'solid-js';
import sdk from '@farcaster/frame-sdk';
import { HomePage, SearchPage, type LyricLine, SubscriptionSlider, I18nProvider, SearchInput } from '@scarlett/ui';
import type { Song } from '@scarlett/ui/components/pages/HomePage';
import { apiService } from './services/api';
import { FarcasterKaraoke } from './components/FarcasterKaraoke';
import { AuthHeader } from './components/AuthHeader';
import { address, isConnected, connectWallet } from './services/wallet';
import { Paywall } from '@unlock-protocol/paywall';
import { Web3Service } from '@unlock-protocol/unlock-js';

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

const App = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [context, setContext] = createSignal<any>(null);
  const [credits] = createSignal(100);
  const [error, setError] = createSignal<string | null>(null);
  const [farcasterUser, setFarcasterUser] = createSignal<any>(null);
  
  // Song selection state
  const [selectedSong, setSelectedSong] = createSignal<Song | null>(null);
  const [songData, setSongData] = createSignal<any>(null);
  const [isLoadingSong, setIsLoadingSong] = createSignal(false);
  
  // Subscription state
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);
  const [hasActiveSubscription, setHasActiveSubscription] = createSignal(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = createSignal(false);
  const [pendingSong, setPendingSong] = createSignal<Song | null>(null);
  const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Song[] | null>(null);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchOffset, setSearchOffset] = createSignal(0);
  const [hasMoreResults, setHasMoreResults] = createSignal(false);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  let searchTimeout: NodeJS.Timeout | null = null;
  
  // User stats state
  const [userStreak, setUserStreak] = createSignal(0);
  const [hasTopPosition, setHasTopPosition] = createSignal(false);

  // Fetch popular songs from the API
  const [popularSongs] = createResource(async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const response = await fetch(`${apiUrl}/api/songs/popular`);
    if (!response.ok) {
      throw new Error('Failed to fetch popular songs');
    }
    
    const data = await response.json();
    
    console.log('[App] Popular songs response:', data);
    
    // Transform the API response to match the Song interface
    const songs = data.data?.map((song: any) => ({
      id: song.id,
      trackId: decodeURIComponent(song.trackId), // Decode the URL-encoded trackId
      title: song.title,
      artist: song.artist,
      artworkUrl: song.artworkUrl,
      artworkUrlSmall: song.artworkUrlSmall,
      artworkUrlMedium: song.artworkUrlMedium,
      artworkUrlLarge: song.artworkUrlLarge
    })) || [];
    
    console.log('[App] Transformed songs:', songs);
    return songs;
  });

  // Handle wallet authentication success
  const handleAuthSuccess = async (walletAddress: string) => {
    try {
      // You can implement JWT token generation here if needed
      console.log('Wallet connected:', walletAddress);
      // Store auth token or update user state as needed
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  // Handle song selection
  const handleSongSelect = async (song: Song) => {
    setIsLoadingSong(true);
    setSelectedSong(song);
    setSearchQuery(''); // Clear search when selecting a song
    setSearchResults(null); // Clear search results
    
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

  // Handle search with debounce
  const handleSearch = (query: string) => {
    console.log('[App] Search query:', query);
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (!query.trim()) {
      console.log('[App] Empty query, clearing results');
      setSearchResults(null);
      setIsSearching(false);
      setSearchOffset(0);
      setHasMoreResults(false);
      return;
    }
    
    setIsSearching(true);
    setSearchOffset(0); // Reset offset for new search
    
    // Debounce search by 300ms
    searchTimeout = setTimeout(async () => {
      console.log('[App] Executing search for:', query);
      try {
        const response = await apiService.searchSongs(query, 20, 0);
        console.log('[App] Search response:', response);
        // Only update results if the query hasn't changed
        if (searchQuery() === query) {
          setSearchResults(response.results || []);
          setHasMoreResults(response.hasMore || false);
          console.log('[App] Updated results:', response.results?.length || 0, 'songs, hasMore:', response.hasMore);
        }
      } catch (error) {
        console.error('[App] Search error:', error);
        if (searchQuery() === query) {
          setSearchResults([]);
          setHasMoreResults(false);
        }
      } finally {
        if (searchQuery() === query) {
          setIsSearching(false);
        }
      }
    }, 300);
  };
  
  // Handle loading more search results
  const handleLoadMore = async () => {
    if (isLoadingMore() || !searchQuery()) return;
    
    setIsLoadingMore(true);
    const newOffset = searchOffset() + 20;
    
    try {
      console.log('[App] Loading more results, offset:', newOffset);
      const response = await apiService.searchSongs(searchQuery(), 20, newOffset);
      console.log('[App] Load more response:', response);
      
      // Append results
      const currentResults = searchResults() || [];
      setSearchResults([...currentResults, ...(response.results || [])]);
      setSearchOffset(newOffset);
      setHasMoreResults(response.hasMore || false);
    } catch (error) {
      console.error('[App] Load more error:', error);
    } finally {
      setIsLoadingMore(false);
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
  
  // Handle karaoke start with subscription check
  const handleKaraokeStart = (startSession: () => void) => {
    // Check if user has an active subscription
    if (!hasActiveSubscription()) {
      // Show subscription modal
      setShowSubscriptionModal(true);
      // Store the callback to execute after subscription
      setPendingAction(() => startSession);
      return;
    }
    
    // If subscribed, start the session
    startSession();
  };
  
  // Handle subscription purchase
  const handleSubscribe = async () => {
    setIsProcessingSubscription(true);
    try {
      const paywall = new Paywall(unlockConfig);
      
      // Set up event listeners
      const handleStatus = (e: any) => {
        console.log('Unlock status:', e.detail);
        if (e.detail.state === 'unlocked') {
          setHasActiveSubscription(true);
          setShowSubscriptionModal(false);
          
          // Clean up listener
          window.removeEventListener('unlockProtocol.status', handleStatus);
          
          // Execute pending action if exists (e.g., start karaoke)
          if (pendingAction()) {
            const action = pendingAction();
            setPendingAction(null);
            if (action) {
              action();
            }
          }
        }
      };
      
      const handleAuthenticated = (e: any) => {
        console.log('User authenticated:', e.detail);
      };
      
      const handleTransaction = (e: any) => {
        console.log('Transaction sent:', e.detail);
      };
      
      // Add event listeners
      window.addEventListener('unlockProtocol.status', handleStatus);
      window.addEventListener('unlockProtocol.authenticated', handleAuthenticated);
      window.addEventListener('unlockProtocol.transactionSent', handleTransaction);
      
      // Show checkout modal
      paywall.loadCheckoutModal();
      
      // Set timeout to reset processing state
      setTimeout(() => {
        setIsProcessingSubscription(false);
      }, 1000);
      
    } catch (error) {
      console.error('Subscription purchase failed:', error);
      setError('Failed to process subscription');
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
      console.log('Unlock membership status:', hasKey);
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
  
  // Fetch user stats
  const fetchUserStats = async (userId: string) => {
    try {
      // Fetch streak
      const streakResponse = await apiService.getUserStreak(userId);
      console.log('[App] Streak response:', streakResponse);
      if (streakResponse && streakResponse.currentStreak !== undefined) {
        setUserStreak(streakResponse.currentStreak);
      } else {
        setUserStreak(0);
      }
      
      // Fetch rankings to check if user has any #1 positions
      const rankingsResponse = await apiService.getUserRankings(userId);
      console.log('[App] Rankings response:', rankingsResponse);
      if (rankingsResponse && rankingsResponse.hasTopPosition !== undefined) {
        setHasTopPosition(rankingsResponse.hasTopPosition);
        console.log('[App] Has top position:', rankingsResponse.hasTopPosition);
      } else {
        setHasTopPosition(false);
      }
    } catch (error) {
      console.log('Error fetching user stats, using defaults:', error);
      // Set default values for new users
      setUserStreak(0);
      setHasTopPosition(false);
    }
  };

  onMount(async () => {
    try {
      // Check if we're in a mini app
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      
      if (inMiniApp) {
        // Get context
        const frameContext = await sdk.context;
        setContext(frameContext);
        
        // Extract Farcaster user data
        if (frameContext?.user) {
          setFarcasterUser({
            fid: frameContext.user.fid,
            username: frameContext.user.username,
            displayName: frameContext.user.displayName,
            pfpUrl: frameContext.user.pfpUrl
          });
          
          // Fetch user stats using FID
          await fetchUserStats(`farcaster-${frameContext.user.fid}`);
        }
        
        // Hide splash screen
        await sdk.actions.ready().catch(console.error);
      } else {
        // For non-Farcaster users, use wallet address or demo user
        const userId = address() || 'demo-user';
        await fetchUserStats(userId);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setError(String(error));
      setIsLoading(false);
    }
  });

  // Detect browser language
  const browserLang = navigator.language.toLowerCase();
  const locale = browserLang.startsWith('zh') ? 'zh-CN' : 'en';
  
  console.log('[App] Browser language detected:', navigator.language);
  console.log('[App] Setting locale to:', locale);

  return (
    <I18nProvider defaultLocale={locale}>
      <div style={{ "min-height": "100vh", "background-color": "#0a0a0a", "color": "#ffffff", display: "flex", "flex-direction": "column" }}>
      <Show
        when={!isLoading()}
        fallback={
          <div style={{ "text-align": "center", "padding": "50px" }}>
            <p style={{ "color": "#ffffff" }}>Loading...</p>
          </div>
        }
      >
        <Show when={!selectedSong()}>
          <AuthHeader 
            farcasterUser={farcasterUser()} 
            onAuthSuccess={handleAuthSuccess}
            currentStreak={userStreak()}
            hasTopPosition={hasTopPosition()}
            onSearch={handleSearch}
            searchQuery={searchQuery()}
          />
        </Show>
        
        <div style={{ flex: 1, display: "flex", "flex-direction": "column" }}>
          <Show
            when={!error()}
            fallback={
              <div style={{ "text-align": "center", "color": "#ef4444", padding: "50px" }}>
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
                <FarcasterKaraoke
                    songUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                    lyrics={lyrics()}
                    trackId={selectedSong()!.trackId}
                    title={selectedSong()!.title}
                    artist={selectedSong()!.artist}
                    artworkUrl={selectedSong()!.artworkUrl}
                    songCatalogId={songData()?.song_catalog_id}
                    apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                    onStartCheck={handleKaraokeStart}
                    onBack={handleBack}
                  />
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
              {/* Content with smooth transition */}
              <div style={{ 
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                opacity: isSearching() && !searchResults() ? 0.5 : 1,
                transform: isSearching() && !searchResults() ? 'translateY(10px)' : 'translateY(0)'
              }}>
                <Show
                  when={!searchQuery()}
                  fallback={
                    <SearchPage
                      songs={searchResults() || []}
                      onSongSelect={handleSongSelect}
                      searchQuery={searchQuery()}
                      onSearch={handleSearch}
                      onLoadMore={handleLoadMore}
                      loading={isSearching()}
                      hasMore={hasMoreResults()}
                      loadingMore={isLoadingMore()}
                      apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                    />
                  }
                >
                  <HomePage
                    songs={popularSongs() || []}
                    onSongSelect={handleSongSelect}
                    showHero={true}
                    showSearch={false}
                    apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                  />
                </Show>
              </div>
            </Show>
          </Show>
          
          </Show>
        </div>
      </Show>
      
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

export default App;