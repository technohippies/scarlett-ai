import { type Component, createResource, createSignal, Show, onMount, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { HomePage as HomePageUI, SearchPage, I18nProvider, type Song } from '@scarlett/ui';
import { AuthHeader } from '../components/AuthHeader';
import { apiService } from '../services/api';
import { address, isConnected } from '../services/wallet';
import sdk from '@farcaster/frame-sdk';

export const HomePage: Component = () => {
  const navigate = useNavigate();
  
  const [farcasterUser, setFarcasterUser] = createSignal<any>(null);
  const [userStreak, setUserStreak] = createSignal(0);
  const [hasTopPosition, setHasTopPosition] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Song[] | null>(null);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchOffset, setSearchOffset] = createSignal(0);
  const [hasMoreResults, setHasMoreResults] = createSignal(false);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  
  let searchTimeout: NodeJS.Timeout | null = null;

  // Fetch popular songs
  const [popularSongs] = createResource(async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const response = await fetch(`${apiUrl}/api/songs/popular`);
    if (!response.ok) {
      throw new Error('Failed to fetch popular songs');
    }
    
    const data = await response.json();
    
    // Transform the API response to match the Song interface
    const songs = data.data?.map((song: any) => ({
      id: song.id,
      trackId: decodeURIComponent(song.trackId),
      title: song.title,
      artist: song.artist,
      artworkUrl: song.artworkUrl,
      artworkUrlSmall: song.artworkUrlSmall,
      artworkUrlMedium: song.artworkUrlMedium,
      artworkUrlLarge: song.artworkUrlLarge
    })) || [];
    
    return songs;
  });

  // Fetch user stats
  const fetchUserStats = async (userId: string) => {
    try {
      const streakResponse = await apiService.getUserStreak(userId);
      if (streakResponse && streakResponse.currentStreak !== undefined) {
        setUserStreak(streakResponse.currentStreak);
      } else {
        setUserStreak(0);
      }
      
      const rankingsResponse = await apiService.getUserRankings(userId);
      if (rankingsResponse && rankingsResponse.hasTopPosition !== undefined) {
        setHasTopPosition(rankingsResponse.hasTopPosition);
      } else {
        setHasTopPosition(false);
      }
    } catch (error) {
      console.log('Error fetching user stats, using defaults:', error);
      setUserStreak(0);
      setHasTopPosition(false);
    }
  };

  onMount(async () => {
    try {
      const inMiniApp = await sdk.isInMiniApp().catch(() => false);
      
      if (inMiniApp) {
        const frameContext = await sdk.context;
        
        if (frameContext?.user) {
          setFarcasterUser({
            fid: frameContext.user.fid,
            username: frameContext.user.username,
            displayName: frameContext.user.displayName,
            pfpUrl: frameContext.user.pfpUrl
          });
          
          await fetchUserStats(`farcaster-${frameContext.user.fid}`);
        }
        
        await sdk.actions.ready().catch(console.error);
      } else {
        const userId = address() || 'demo-user';
        await fetchUserStats(userId);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  });

  const handleSongSelect = (song: Song) => {
    navigate(`/${song.trackId}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      setSearchOffset(0);
      setHasMoreResults(false);
      return;
    }
    
    setIsSearching(true);
    setSearchOffset(0);
    
    searchTimeout = setTimeout(async () => {
      try {
        const response = await apiService.searchSongs(query, 20, 0);
        if (searchQuery() === query) {
          setSearchResults(response.results || []);
          setHasMoreResults(response.hasMore || false);
        }
      } catch (error) {
        console.error('Search error:', error);
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
  
  const handleLoadMore = async () => {
    if (isLoadingMore() || !searchQuery()) return;
    
    setIsLoadingMore(true);
    const newOffset = searchOffset() + 20;
    
    try {
      const response = await apiService.searchSongs(searchQuery(), 20, newOffset);
      
      const currentResults = searchResults() || [];
      setSearchResults([...currentResults, ...(response.results || [])]);
      setSearchOffset(newOffset);
      setHasMoreResults(response.hasMore || false);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAuthSuccess = async (walletAddress: string) => {
    console.log('Wallet connected:', walletAddress);
  };

  // Detect browser language
  const browserLang = navigator.language.toLowerCase();
  const locale = browserLang.startsWith('zh') ? 'zh-CN' : 'en';

  return (
    <I18nProvider defaultLocale={locale}>
      <div style={{ "min-height": "100vh", "background-color": "#0a0a0a", "color": "#ffffff", display: "flex", "flex-direction": "column" }}>
        <AuthHeader 
          farcasterUser={farcasterUser()} 
          onAuthSuccess={handleAuthSuccess}
          currentStreak={userStreak()}
          hasTopPosition={hasTopPosition()}
          onSearch={handleSearch}
          searchQuery={searchQuery()}
        />
        
        <div style={{ flex: 1, display: "flex", "flex-direction": "column" }}>
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
                <HomePageUI
                  songs={popularSongs() || []}
                  onSongSelect={handleSongSelect}
                  showHero={true}
                  showSearch={false}
                  apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                />
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </I18nProvider>
  );
};