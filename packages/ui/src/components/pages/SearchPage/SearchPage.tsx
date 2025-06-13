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
}

export interface SearchPageProps {
  songs?: Song[];
  onSongSelect?: (song: Song) => void;
  onSearch?: (query: string) => void;
  loading?: boolean;
  searchQuery?: string;
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
            placeholder={t('search.placeholder', 'Search songs, artists...')}
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
              {t('search.loading', 'Searching...')}
            </div>
          }
        >
          <Show
            when={filteredSongs().length > 0}
            fallback={
              <div class="text-center py-16">
                <p class="text-text-secondary text-lg mb-2">
                  {query() 
                    ? t('search.noResults', 'No results found')
                    : t('search.startTyping', 'Start typing to search')
                  }
                </p>
                <Show when={query()}>
                  <p class="text-text-tertiary">
                    {t('search.tryDifferent', 'Try searching for something else')}
                  </p>
                </Show>
              </div>
            }
          >
            <div class="mb-4">
              <p class="text-text-secondary">
                {t('search.resultsCount', `${filteredSongs().length} results`)}
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
                      <div>
                        <h3 class="font-semibold text-text-primary">
                          {song.title}
                        </h3>
                        <p class="text-text-secondary text-sm">
                          {song.artist}
                        </p>
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
          </Show>
        </Show>
      </div>
    </div>
  );
};