import type { Component } from 'solid-js';
import { For, Show, createSignal, createEffect } from 'solid-js';
import { useI18n } from '../../../i18n/provider';
import { Button } from '../../common/Button';
import { SearchInput } from '../../common/SearchInput';
import { getImageUrl } from '../../../utils/images';
import { interactiveListItemStyles, listContainerStyles } from '../../../utils/interactiveListStyles';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../common/Spinner';

export interface Song {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  hasLyrics?: boolean;
  source?: 'local' | 'soundcloak';
  artworkUrl?: string;
  artworkUrlSmall?: string;
  artworkUrlMedium?: string;
  artworkUrlLarge?: string;
}

export interface HomePageProps {
  songs: Song[];
  onSongSelect?: (song: Song) => void;
  showHero?: boolean;
  onGetStarted?: () => void;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
  apiUrl?: string;
  // New props for header
  userStreak?: number;
  hasTopPosition?: boolean;
  isConnected?: boolean;
  onConnect?: () => void;
  // Loading state
  isLoading?: boolean;
  loadingError?: string;
}

export const HomePage: Component<HomePageProps> = (props) => {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearchResults, setShowSearchResults] = createSignal(false);
  
  console.log('[HomePage] Current locale:', locale());
  console.log('[HomePage] Hero title translation:', t('homepage.hero.title'));
  console.log('[HomePage] Hero subtitle translation:', t('homepage.hero.subtitle'));
  
  // Track search state
  createEffect(() => {
    setShowSearchResults(searchQuery().length > 0);
  });
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    props.onSearch?.(query);
  };

  return (
    <div class="min-h-screen bg-base text-primary flex flex-col">
      <div class="flex-1 flex flex-col">
        <Show when={props.isLoading}>
          <div class="text-center py-12">
            <Spinner size="lg" />
          </div>
        </Show>
        
        <Show when={props.loadingError}>
          <div class="text-center py-12">
            <p class="text-error text-lg">{props.loadingError}</p>
          </div>
        </Show>
        
        <Show when={!props.isLoading && !props.loadingError}>
          <Show when={!showSearchResults() && props.showHero !== false}>
        {/* Hero Section */}
        <div style={{ 
          padding: '64px 16px',
          'text-align': 'center',
          background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background decoration */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            'inset-inline-end': '-10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
            'border-radius': '50%'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30%',
            'inset-inline-start': '-10%',
            width: '250px',
            height: '250px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)',
            'border-radius': '50%'
          }} />
          
          {/* Content */}
          <div style={{ position: 'relative', 'z-index': 1 }}>
            <h1 style={{ 
              margin: '0 0 16px 0', 
              'font-size': '40px',
              'font-weight': 'bold',
              color: 'white',
              'text-shadow': '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {t('homepage.hero.title')}
            </h1>
            <p style={{ 
              margin: '0', 
              'font-size': '20px',
              color: 'rgba(255,255,255,0.9)',
              'max-width': '600px',
              'margin-inline': 'auto',
              'padding-bottom': props.onGetStarted ? '32px' : '0'
            }}>
              {t('homepage.hero.subtitle')}
            </p>
            <Show when={props.onGetStarted}>
              <Button
                variant="primary"
                size="lg"
                onClick={props.onGetStarted}
                style={{
                  background: 'white',
                  color: 'var(--color-accent-primary)',
                  'box-shadow': '0 4px 12px rgba(0,0,0,0.2)',
                  'font-weight': 'bold'
                }}
              >
                {t('homepage.hero.getStarted')}
              </Button>
            </Show>
          </div>
        </div>
          </Show>
          
          {/* Search Section - only show when explicitly enabled */}
          <Show when={props.showSearch === true}>
        <div style={{ 
          'background-color': 'var(--color-bg-surface)',
          'border-bottom': '1px solid var(--color-border-default)',
          padding: '32px 16px'
        }}>
          <div style={{ 
            'max-width': '672px',
            margin: '0 auto'
          }}>
            <SearchInput
              value={searchQuery()}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setSearchQuery(value);
                props.onSearch?.(value);
              }}
              onClear={() => {
                setSearchQuery('');
                props.onSearch?.('');
              }}
              placeholder={t('common.search.placeholder')}
              style={{
                width: '100%'
              }}
            />
          </div>
        </div>
          </Show>
          
          {/* Content transitions based on search state */}
          <div class={cn(
            "transition-all duration-300 ease-out",
            showSearchResults() && !props.songs.length ? "opacity-50 translate-y-2" : "opacity-100 translate-y-0"
          )}>
            <Show when={!showSearchResults()}>
              {/* Trending Songs Section */}
              <div style={{ padding: '16px 16px 0 16px' }}>
        <h2 style={{ margin: '0', 'font-size': '20px', 'font-weight': 'bold' }}>
          {t('homepage.trending')}
        </h2>
              </div>
              
              <div style={{ padding: '8px 16px 16px 16px' }} class={listContainerStyles({ variant: 'compact' })}>
        <For each={props.songs}>
          {(song, index) => (
            <div 
              class={interactiveListItemStyles({ variant: 'compact' })}
              onClick={() => props.onSongSelect?.(song)}
            >
              <div style={{ display: 'flex', gap: '12px', 'align-items': 'center' }}>
                <span style={{ 
                  color: 'var(--color-text-primary)',
                  'font-size': '24px',
                  'font-weight': 'bold',
                  'min-width': '30px',
                  'text-align': 'center'
                }}>
                  {index() + 1}
                </span>
                <Show 
                  when={getImageUrl(song.artworkUrl, props.apiUrl || '', song.trackId)}
                  fallback={
                    <div style={{
                      width: '48px',
                      height: '48px',
                      'background-color': 'var(--color-bg-surface)',
                      'border-radius': '4px',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'flex-shrink': 0
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                    </div>
                  }
                >
                  <img 
                    src={getImageUrl(song.artworkUrl, props.apiUrl || '', song.trackId)}
                    alt={`${song.title} artwork`}
                    style={{
                      width: '48px',
                      height: '48px',
                      'object-fit': 'cover',
                      'border-radius': '4px',
                      'flex-shrink': 0
                    }}
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Failed to load artwork for ${song.title}:`, song.artworkUrl);
                      // Hide the broken image and show fallback
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </Show>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    'font-weight': 'bold',
                    'font-size': '18px',
                    'margin-bottom': '4px'
                  }}>
                    {song.title}
                  </div>
                  <div style={{ 
                    color: 'var(--color-text-secondary)',
                    'font-size': '16px' 
                  }}>
                    {song.artist}
                  </div>
                </div>
                <svg
                  class="w-5 h-5 text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 rtl:scale-x-[-1]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};