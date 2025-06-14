import type { Component } from 'solid-js';
import { Show, For, createSignal, onMount } from 'solid-js';
import { SearchInput } from '../../common/SearchInput';
import { Button } from '../../common/Button';
import { useI18n } from '../../../i18n/provider';
import { interactiveListItemStyles, listContainerStyles } from '../../../utils/interactiveListStyles';
import { cn } from '../../../utils/cn';

export interface Song {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  hasLyrics?: boolean;
  source?: 'local' | 'soundcloak';
  plays?: number;
  likes?: number;
  artworkUrl?: string;
  artworkUrlSmall?: string;
  artworkUrlMedium?: string;
  artworkUrlLarge?: string;
}

export interface SearchPageProps {
  songs?: Song[];
  onSongSelect?: (song: Song) => void;
  onSearch?: (query: string) => void;
  onLoadMore?: () => void;
  loading?: boolean;
  searchQuery?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  apiUrl?: string;
}

export const SearchPage: Component<SearchPageProps> = (props) => {
  const { t } = useI18n();
  const [query, setQuery] = createSignal(props.searchQuery || '');

  onMount(() => {
    console.log('[SearchPage] Props:', {
      hasMore: props.hasMore,
      loadingMore: props.loadingMore,
      songsCount: props.songs?.length
    });
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    props.onSearch?.(value);
  };

  const filteredSongs = () => {
    if (!query() || !props.songs) return props.songs || [];
    
    const searchTerm = query().toLowerCase();
    return props.songs.filter(song => 
      song.title.toLowerCase().includes(searchTerm) || 
      song.artist.toLowerCase().includes(searchTerm)
    );
  };

  return (
    <div class="min-h-screen bg-bg-primary">
      {/* Search Results */}
      <div class="p-4 pt-8">
        <Show 
          when={!props.loading}
          fallback={
            <div class="text-center py-8 text-text-secondary">
              {t('common.search.loading', 'Searching...')}
            </div>
          }
        >
          <Show
            when={filteredSongs().length > 0}
            fallback={
              <div class="text-center py-16">
                <p class="text-text-secondary text-lg mb-2">
                  {query() 
                    ? t('common.search.noResults', 'No results found')
                    : t('common.search.startTyping', 'Start typing to search')
                  }
                </p>
                <Show when={query()}>
                  <p class="text-text-tertiary">
                    {t('common.search.tryDifferent', 'Try searching for something else')}
                  </p>
                </Show>
              </div>
            }
          >
            
            <div class={listContainerStyles({ variant: 'compact' })}>
              <For each={filteredSongs()}>
                {(song) => (
                  <button
                    onClick={() => props.onSongSelect?.(song)}
                    class={cn('w-full text-left', interactiveListItemStyles({ variant: 'compact' }))}
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <h3 class="font-semibold text-text-primary">
                          {song.title}
                        </h3>
                        <p class="text-text-secondary text-sm">
                          {song.artist}
                        </p>
                        <Show when={song.plays || song.hasLyrics}>
                          <p class="text-text-tertiary text-xs mt-1">
                            <Show when={song.plays}>
                              <span>{song.plays.toLocaleString()} plays</span>
                            </Show>
                            <Show when={song.hasLyrics}>
                              <span class="text-accent-success"><Show when={song.plays}> • </Show>Has lyrics ✓</span>
                            </Show>
                          </p>
                        </Show>
                      </div>
                      <svg
                        class="w-5 h-5 text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
                  </button>
                )}
              </For>
            </div>
            
            {/* Load More Button */}
            <Show when={props.hasMore}>
              <div class="mt-6">
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => props.onLoadMore?.()}
                  loading={props.loadingMore}
                >
                  {t('common.search.loadMore', 'Load more')}
                </Button>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
};