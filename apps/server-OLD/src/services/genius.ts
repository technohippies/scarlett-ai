/**
 * Genius API Service
 *
 * Custom implementation since existing libraries are outdated/broken
 * Uses the official Genius API to search for songs and get metadata
 */

export interface GeniusSong {
  id: number;
  title: string;
  primary_artist: {
    name: string;
    id: number;
  };
  url: string;
  song_art_image_url: string;
  release_date_for_display?: string;
  album?: {
    name: string;
  };
  media?: Array<{
    provider: string;
    type: string;
    url: string;
    start?: number;
    attribution?: string;
  }>;
}

export interface GeniusSearchResponse {
  meta: {
    status: number;
  };
  response: {
    hits: Array<{
      type: string;
      result: GeniusSong;
    }>;
  };
}

export interface VideoMatchResult {
  found: boolean;
  song?: GeniusSong;
  confidence: number;
  query_used: string;
}

export class GeniusService {
  private apiKey: string;
  private baseUrl = 'https://api.genius.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Check if Genius song has matching SoundCloud URL for given track ID
   */
  private checkSoundCloudMatch(trackId: string, song: GeniusSong): boolean {
    if (!song.media) return false;

    // Extract expected SoundCloud path from trackId
    // e.g., "eminemofficial/superman-album-version"
    const expectedPath = trackId.toLowerCase();

    for (const media of song.media) {
      if (media.provider === 'soundcloud' && media.url) {
        // Extract path from SoundCloud URL
        // e.g., "https://soundcloud.com/eminemofficial/superman-album-version?in=..."
        const urlPath = this.extractSoundCloudPath(media.url);

        if (this.pathsMatch(expectedPath, urlPath)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract the artist/track path from a SoundCloud URL
   */
  private extractSoundCloudPath(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove leading slash and query params
      return urlObj.pathname.substring(1).split('?')[0].toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Check if two SoundCloud paths match (with normalization)
   */
  private pathsMatch(path1: string, path2: string): boolean {
    // Normalize paths for comparison
    const normalize = (path: string) =>
      path
        .replace(/[-_]/g, '') // Remove hyphens and underscores
        .replace(/\s+/g, '') // Remove spaces
        .toLowerCase();

    return normalize(path1) === normalize(path2);
  }

  /**
   * Extract potential song information from YouTube video title
   */
  private extractSongInfo(videoTitle: string): {
    artist?: string;
    title?: string;
    cleanQuery: string;
  } {
    // Remove common YouTube noise
    let clean = videoTitle
      .replace(/\(Official.*?\)/gi, '')
      .replace(/\[Official.*?\]/gi, '')
      .replace(/\(Music Video\)/gi, '')
      .replace(/\[Music Video\]/gi, '')
      .replace(/\(Live\)/gi, '')
      .replace(/\[Live\]/gi, '')
      .replace(/\(Audio\)/gi, '')
      .replace(/\[Audio\]/gi, '')
      .replace(/HD/gi, '')
      .replace(/4K/gi, '')
      .replace(/Official/gi, '')
      .replace(/Video/gi, '')
      .trim();

    // Try to detect artist - title patterns
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/, // Artist - Title
      /^(.+?)\s*[|]\s*(.+)$/, // Artist | Title
      /^(.+?)\s*[:]\s*(.+)$/, // Artist : Title
      /^(.+?)\s*[–]\s*(.+)$/, // Artist – Title (em dash)
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match) {
        return {
          artist: match[1].trim(),
          title: match[2].trim(),
          cleanQuery: clean,
        };
      }
    }

    return { cleanQuery: clean };
  }

  /**
   * Search for songs on Genius
   */
  async searchSongs(query: string, limit = 5): Promise<GeniusSong[]> {
    try {
      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('per_page', limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'Scarlett-Karaoke/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Genius API error: ${response.status}`);
      }

      const data: GeniusSearchResponse = await response.json();

      return data.response.hits
        .filter((hit) => hit.type === 'song')
        .map((hit) => hit.result);
    } catch (error) {
      console.error('[Genius] Search failed:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two strings (simple algorithm)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    // Jaccard similarity with word tokens
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Find best matching song for a track (with optional SoundCloud validation)
   */
  async findVideoMatch(
    videoTitle: string,
    trackId?: string
  ): Promise<VideoMatchResult> {
    const extracted = this.extractSongInfo(videoTitle);

    console.log('[Genius] Searching for:', {
      original: videoTitle,
      extracted: extracted,
    });

    try {
      // Search with the clean query first
      const songs = await this.searchSongs(extracted.cleanQuery, 10);

      if (songs.length === 0) {
        return {
          found: false,
          confidence: 0,
          query_used: extracted.cleanQuery,
        };
      }

      // Filter out translation pages and covers
      const filteredSongs = songs.filter((song) => {
        const artistName = song.primary_artist.name.toLowerCase();
        const songTitle = song.title.toLowerCase();

        // Skip translation pages (multiple languages)
        const translationTerms = [
          'traduction',
          'translation',
          'übersetzung',
          'deutsche',
          'türkçe',
          'çeviri',
          'español',
          'française',
          'français',
          'italiano',
          'português',
          'русский',
          'svenska',
          'översättning',
          'svensk',
          'översättningar',
          'genius traductions',
          'genius übersetzungen',
          'genius türkçe',
          'genius deutsche',
          'genius svenska',
        ];

        const hasTranslationTerms = translationTerms.some(
          (term) => artistName.includes(term) || songTitle.includes(term)
        );

        if (hasTranslationTerms) {
          return false;
        }

        // Skip cover versions unless specifically searching for them
        if (
          artistName.includes('cover') &&
          !extracted.cleanQuery.toLowerCase().includes('cover')
        ) {
          return false;
        }

        return true;
      });

      // Score each result
      let bestMatch: GeniusSong | undefined;
      let bestScore = 0;

      for (const song of filteredSongs) {
        let score = 0;

        // Check for SoundCloud URL match first (instant high confidence)
        const hasSoundCloudMatch = trackId
          ? this.checkSoundCloudMatch(trackId, song)
          : false;

        if (hasSoundCloudMatch) {
          console.log('[Genius] Found SoundCloud URL match - high confidence');
          score = 0.95; // Very high score for SoundCloud match
        } else {
          // Standard similarity scoring
          const titleSim = this.calculateSimilarity(
            extracted.title || extracted.cleanQuery,
            song.title
          );
          score += titleSim * 0.6;

          // Calculate artist similarity if we have artist info
          if (extracted.artist) {
            const artistSim = this.calculateSimilarity(
              extracted.artist,
              song.primary_artist.name
            );
            score += artistSim * 0.4;
          }

          // Bonus for exact matches
          if (titleSim > 0.9) score += 0.1;
          if (
            extracted.artist &&
            this.calculateSimilarity(
              extracted.artist,
              song.primary_artist.name
            ) > 0.9
          ) {
            score += 0.1;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = song;
        }
      }

      // Require minimum confidence threshold
      const found = bestScore > 0.15;

      console.log('[Genius] Best match:', {
        found,
        confidence: bestScore,
        song: bestMatch
          ? `${bestMatch.primary_artist.name} - ${bestMatch.title}`
          : 'none',
      });

      return {
        found,
        song: bestMatch,
        confidence: bestScore,
        query_used: extracted.cleanQuery,
      };
    } catch (error) {
      console.error('[Genius] Match search failed:', error);
      return {
        found: false,
        confidence: 0,
        query_used: extracted.cleanQuery,
      };
    }
  }

  /**
   * Get song details by ID
   */
  async getSongById(songId: number): Promise<GeniusSong | null> {
    try {
      const response = await fetch(`${this.baseUrl}/songs/${songId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'Scarlett-Karaoke/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Genius API error: ${response.status}`);
      }

      const data: { response: { song: GeniusSong } } = await response.json();
      return data.response.song;
    } catch (error) {
      console.error('[Genius] Get song failed:', error);
      return null;
    }
  }
}
