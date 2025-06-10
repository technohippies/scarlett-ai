/**
 * LRCLib Service
 *
 * Wrapper around lrclib-api for synchronized lyrics
 * Provides clean interface for fetching lyrics data
 */

import {
  findLyrics,
  getSynced,
  getUnsynced,
  type FindLyricsResponse,
  type LyricLine,
} from 'lrclib-api';

export interface LyricsQuery {
  track_name: string;
  artist_name: string;
  album_name?: string;
  duration?: number;
}

// Use the types from lrclib-api directly
export type LyricsMetadata = FindLyricsResponse;
export type SyncedLyricLine = LyricLine;
export type UnsyncedLyricLine = LyricLine;

export class LRCLibService {
  constructor() {
    // No client needed - lrclib-api exports functions directly
  }

  /**
   * Find lyrics metadata for a song
   */
  async findLyrics(query: LyricsQuery): Promise<LyricsMetadata | null> {
    try {
      console.log('[LRCLib] Searching for lyrics:', query);

      const result = await findLyrics(query);

      if (!result) {
        console.log('[LRCLib] No lyrics found');
        return null;
      }

      console.log('[LRCLib] Found lyrics:', {
        track: result.trackName,
        artist: result.artistName,
        hasSynced: !!result.syncedLyrics,
        hasPlain: !!result.plainLyrics,
        instrumental: result.instrumental,
      });

      return result;
    } catch (error) {
      console.error('[LRCLib] Search failed:', error);
      // Try a simplified search if the original fails
      if (query.album_name) {
        console.log('[LRCLib] Retrying without album name...');
        return this.findLyrics({
          track_name: query.track_name,
          artist_name: query.artist_name,
        });
      }
      return null;
    }
  }

  /**
   * Get synchronized (timed) lyrics as array of lines with retry logic
   */
  async getSyncedLyrics(
    query: LyricsQuery,
    retries: number = 3
  ): Promise<SyncedLyricLine[] | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `[LRCLib] Getting synced lyrics for: ${query.track_name} - ${query.artist_name} (attempt ${attempt}/${retries})`
        );

        const result = await getSynced(query);

        if (!result || result.length === 0) {
          console.log('[LRCLib] No synced lyrics found in response');
          return null;
        }

        console.log('[LRCLib] Found synced lyrics:', result.length, 'lines');

        // Debug: Log the first few lines to check structure
        console.log(
          '[LRCLib] First 3 synced lines:',
          result.slice(0, 3).map((line) => ({
            text: line.text,
            startTime: line.startTime,
            hasStartTime:
              line.startTime !== undefined && line.startTime !== null,
          }))
        );

        // Check if any lines have valid timestamps
        const hasValidTimestamps = result.some(
          (line) => line.startTime && line.startTime > 0
        );
        if (!hasValidTimestamps) {
          console.warn(
            '[LRCLib] WARNING: Synced lyrics returned but no valid timestamps found!'
          );
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[LRCLib] Synced lyrics attempt ${attempt} failed:`,
          errorMessage
        );

        // If it's not a network error or we're out of retries, return null
        if (attempt === retries || !errorMessage.includes('Network')) {
          console.log(
            '[LRCLib] Giving up on synced lyrics after',
            attempt,
            'attempts'
          );
          return null;
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[LRCLib] Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return null;
  }

  /**
   * Get plain (unsynced) lyrics as array of lines
   */
  async getUnsyncedLyrics(
    query: LyricsQuery
  ): Promise<UnsyncedLyricLine[] | null> {
    try {
      console.log('[LRCLib] Getting unsynced lyrics for:', query);

      const result = await getUnsynced(query);

      if (!result || result.length === 0) {
        console.log('[LRCLib] No unsynced lyrics found');
        return null;
      }

      console.log('[LRCLib] Found unsynced lyrics:', result.length, 'lines');
      return result;
    } catch (error) {
      console.error('[LRCLib] Unsynced lyrics failed:', error);
      return null;
    }
  }

  /**
   * Get best available lyrics with multiple search strategies
   */
  async getBestLyrics(query: LyricsQuery): Promise<{
    type: 'synced' | 'unsynced' | 'none';
    lyrics: SyncedLyricLine[] | UnsyncedLyricLine[] | null;
    metadata?: LyricsMetadata;
  }> {
    try {
      // Create title variations for fuzzy search
      const titleVariations = this.createTitleVariations(query.track_name);
      console.log('[LRCLib] Trying title variations:', titleVariations);

      let bestUnsyncedResult: {
        lyrics: UnsyncedLyricLine[];
        metadata: LyricsMetadata;
      } | null = null;

      // Try each variation until we find synced lyrics
      for (const titleVariation of titleVariations) {
        const searchQuery = { ...query, track_name: titleVariation };

        // Get metadata first to check what's available
        const metadata = await this.findLyrics(searchQuery);

        if (!metadata) {
          continue; // Try next variation
        }

        if (metadata.instrumental) {
          return {
            type: 'none',
            lyrics: null,
            metadata,
          };
        }

        // Try synced first with retries
        if (metadata.syncedLyrics) {
          console.log(
            `[LRCLib] Metadata indicates synced lyrics available for: "${titleVariation}"`
          );

          // Try to parse the synced lyrics string directly if getSynced fails
          let syncedLyrics: SyncedLyricLine[] | null = null;

          // If metadata has album but our query doesn't, try with album
          if (metadata.albumName && !searchQuery.album_name) {
            console.log(
              `[LRCLib] Retrying with album from metadata: "${metadata.albumName}"`
            );
            const enhancedQuery = {
              ...searchQuery,
              album_name: metadata.albumName,
            };
            syncedLyrics = await this.getSyncedLyrics(enhancedQuery);
          }

          // Try without album info if we didn't get lyrics yet
          if (!syncedLyrics) {
            syncedLyrics = await this.getSyncedLyrics(searchQuery);
          }

          // If getSynced returned lyrics but with no valid timestamps, try parsing directly
          if (syncedLyrics && syncedLyrics.length > 0) {
            const hasValidTimestamps = syncedLyrics.some(
              (line) => line.startTime && line.startTime > 0
            );

            if (!hasValidTimestamps && metadata.syncedLyrics) {
              console.log(
                '[LRCLib] getSynced returned invalid timestamps, parsing LRC string directly...'
              );
              const parsedLyrics = LRCLibService.parseLRCString(
                metadata.syncedLyrics
              );
              if (parsedLyrics.length > 0) {
                console.log(
                  `[LRCLib] Successfully parsed ${parsedLyrics.length} lines from LRC string`
                );
                syncedLyrics = parsedLyrics;
              }
            }
          }

          if (syncedLyrics && syncedLyrics.length > 0) {
            console.log(
              `[LRCLib] Successfully found synced lyrics with title: "${titleVariation}"`
            );
            return {
              type: 'synced',
              lyrics: syncedLyrics,
              metadata,
            };
          } else {
            console.log(
              `[LRCLib] Failed to fetch synced lyrics despite metadata indicating availability`
            );
          }
        }

        // Store best unsynced result as fallback
        if (metadata.plainLyrics && !bestUnsyncedResult) {
          const unsyncedLyrics = await this.getUnsyncedLyrics(searchQuery);
          if (unsyncedLyrics) {
            bestUnsyncedResult = { lyrics: unsyncedLyrics, metadata };
            console.log(
              `[LRCLib] Found unsynced lyrics for "${titleVariation}", continuing search for synced...`
            );
          }
        }
      }

      // Return best unsynced result if we have one
      if (bestUnsyncedResult) {
        console.log(
          '[LRCLib] No synced lyrics found, returning unsynced lyrics'
        );
        return {
          type: 'unsynced',
          lyrics: bestUnsyncedResult.lyrics,
          metadata: bestUnsyncedResult.metadata,
        };
      }

      return {
        type: 'none',
        lyrics: null,
      };
    } catch (error) {
      console.error('[LRCLib] Best lyrics search failed:', error);
      return { type: 'none', lyrics: null };
    }
  }

  /**
   * Create title variations for fuzzy matching
   */
  private createTitleVariations(title: string): string[] {
    const variations = new Set<string>();

    // Original title
    variations.add(title);

    // Remove parentheses content (feat., remix, etc.)
    const withoutParens = title.replace(/\([^)]*\)/g, '').trim();
    if (withoutParens !== title) {
      variations.add(withoutParens);
    }

    // Remove brackets content
    const withoutBrackets = title.replace(/\[[^\]]*\]/g, '').trim();
    if (withoutBrackets !== title) {
      variations.add(withoutBrackets);
    }

    // Remove common suffixes
    const suffixes = [
      ' - Radio Edit',
      ' - Album Version',
      ' - Single Version',
      ' - Remastered',
      ' - Remix',
    ];
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) {
        variations.add(title.slice(0, -suffix.length).trim());
      }
    }

    // Remove "feat." or "ft." and everything after
    const featMatch = title.match(/^(.*?)\s+(feat\.|ft\.)/i);
    if (featMatch) {
      variations.add(featMatch[1].trim());
    }

    // Try just the first part before common delimiters
    const delimiters = [' - ', ' — ', ' | ', ' / '];
    for (const delimiter of delimiters) {
      const parts = title.split(delimiter);
      if (parts.length > 1) {
        variations.add(parts[0].trim());
      }
    }

    return Array.from(variations);
  }

  /**
   * Create artist variations for better matching
   */
  private createArtistVariations(artist: string): string[] {
    const variations = new Set<string>();

    // Original artist
    variations.add(artist);

    // Handle "The" prefix
    if (artist.startsWith('The ')) {
      variations.add(artist.substring(4)); // Remove "The "
    } else if (!artist.startsWith('The ')) {
      variations.add('The ' + artist); // Add "The "
    }

    // Handle "&" vs "and"
    if (artist.includes(' & ')) {
      variations.add(artist.replace(/ & /g, ' and '));
    } else if (artist.includes(' and ')) {
      variations.add(artist.replace(/ and /g, ' & '));
    }

    // Handle common variations
    const replacements = [
      ['feat.', 'ft.'],
      ['featuring', 'feat.'],
      ['w/', 'with'],
    ];

    for (const [from, to] of replacements) {
      if (artist.toLowerCase().includes(from)) {
        variations.add(artist.replace(new RegExp(from, 'gi'), to));
      }
    }

    return Array.from(variations);
  }

  /**
   * Convert LRC format to structured lyrics
   * Useful for parsing raw LRC strings
   */
  static parseLRCString(lrcString: string): SyncedLyricLine[] {
    const lines: SyncedLyricLine[] = [];
    const lrcLines = lrcString.split('\n');

    for (const line of lrcLines) {
      // Match [MM:SS.xx] format
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)$/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const centiseconds = parseInt(match[3], 10);
        const text = match[4].trim();

        // Convert to milliseconds
        const startTime = (minutes * 60 + seconds) * 1000 + centiseconds * 10;

        if (text) {
          // Only add non-empty lines
          lines.push({
            text,
            startTime,
          });
        }
      }
    }

    return lines.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  }

  /**
   * Format lyrics for display with timestamps
   */
  static formatSyncedLyrics(lyrics: SyncedLyricLine[]): string {
    return lyrics
      .map((line) => {
        const startTime = line.startTime || 0;
        const minutes = Math.floor(startTime / 60000);
        const seconds = Math.floor((startTime % 60000) / 1000);
        const centiseconds = Math.floor((startTime % 1000) / 10);

        return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}] ${line.text}`;
      })
      .join('\n');
  }
}
