import type { Component } from 'solid-js';
import { For, Show, createSignal } from 'solid-js';
import { useI18n } from '../../../i18n/provider';
import { Button } from '../../common/Button';
import { SearchInput } from '../../common/SearchInput';
import { getImageUrl } from '../../../utils/images';

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
}

export const HomePage: Component<HomePageProps> = (props) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = createSignal('');
  
  
  const songItemStyle = {
    padding: '16px',
    'margin-bottom': '8px',
    'background-color': 'transparent',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  return (
    <div>
      <Show when={props.showHero !== false}>
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
            right: '-10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
            'border-radius': '50%'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30%',
            left: '-10%',
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
              'margin-left': 'auto',
              'margin-right': 'auto',
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
      
      {/* Search Section */}
      <Show when={props.showSearch !== false}>
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
      
      {/* Trending Songs Section */}
      <div style={{ padding: '16px 16px 0 16px' }}>
        <h2 style={{ margin: '0', 'font-size': '20px', 'font-weight': 'bold' }}>
          {t('homepage.trending')}
        </h2>
      </div>
      
      <div style={{ padding: '8px 16px 16px 16px' }}>
        <For each={props.songs}>
          {(song, index) => (
            <div 
              style={songItemStyle}
              onClick={() => props.onSongSelect?.(song)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                e.currentTarget.style.transform = 'translateX(8px)';
                const arrow = e.currentTarget.querySelector('.arrow-icon') as HTMLElement;
                if (arrow) arrow.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateX(0)';
                const arrow = e.currentTarget.querySelector('.arrow-icon') as HTMLElement;
                if (arrow) arrow.style.opacity = '0';
              }}
            >
              <div style={{ display: 'flex', gap: '16px', 'align-items': 'center' }}>
                <span style={{ 
                  color: 'var(--color-accent-primary)',
                  'font-size': '24px',
                  'font-weight': 'bold',
                  'min-width': '40px'
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
                  style={{
                    width: '20px',
                    height: '20px',
                    color: 'var(--color-accent-primary)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  class="arrow-icon"
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
    </div>
  );
};