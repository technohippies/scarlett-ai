import type { Component } from 'solid-js';
import { Show, For, createSignal } from 'solid-js';
import { SearchInput } from '../../common/SearchInput';
import { useI18n } from '../../../i18n/provider';
import IconArrowRightRegular from 'phosphor-icons-solid/IconArrowRightRegular';

export interface Song {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  hasLyrics?: boolean;
  source?: 'local' | 'soundcloak';
  plays?: number;
  likes?: number;
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
}

export const SearchPage: Component<SearchPageProps> = (props) => {
  const { t } = useI18n();
  const [query, setQuery] = createSignal(props.searchQuery || '');

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
      {/* Search Header */}
      <div class="sticky top-0 bg-bg-primary/95 backdrop-blur-sm border-b border-default z-10">
        <div class="p-4">
          <SearchInput
            value={query()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
            onClear={() => handleSearch('')}
            placeholder={t('common.search.placeholder', 'Search songs, artists...')}
            autofocus
          />
        </div>
      </div>

      {/* Search Results */}
      <div class="p-4">
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
            <div class="mb-4">
              <p class="text-text-secondary">
                {filteredSongs().length} results
              </p>
            </div>
            
            <div class="space-y-2">
              <For each={filteredSongs()}>
                {(song) => (
                  <button
                    onClick={() => props.onSongSelect?.(song)}
                    class="w-full p-4 bg-surface rounded-lg hover:bg-surface-hover 
                           transition-all duration-200 text-left group
                           hover:translate-x-1"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <h3 class="font-semibold text-text-primary">
                          {song.title}
                        </h3>
                        <p class="text-text-secondary text-sm">
                          {song.artist}
                        </p>
                        <Show when={song.source || song.plays}>
                          <p class="text-text-tertiary text-xs mt-1">
                            <Show when={song.source === 'soundcloak'}>
                              <span>From SoundCloud</span>
                              <Show when={song.plays}>
                                <span> • {song.plays.toLocaleString()} plays</span>
                              </Show>
                            </Show>
                            <Show when={song.hasLyrics}>
                              <span class="text-accent-success"> • Has lyrics ✓</span>
                            </Show>
                          </p>
                        </Show>
                      </div>
                      <IconArrowRightRegular 
                        class="w-5 h-5 text-text-tertiary opacity-0 
                               group-hover:opacity-100 transition-opacity" 
                      />
                    </div>
                  </button>
                )}
              </For>
            </div>
            
            {/* Load More Button */}
            <Show when={props.hasMore}>
              <div class="mt-6 flex justify-center">
                <button
                  onClick={() => props.onLoadMore?.()}
                  disabled={props.loadingMore}
                  class="px-6 py-3 bg-surface hover:bg-surface-hover 
                         rounded-lg transition-colors duration-200
                         text-text-primary font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {props.loadingMore 
                    ? t('common.search.loadingMore', 'Loading more...') 
                    : t('common.search.loadMore', 'Load more tracks')
                  }
                </button>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
};