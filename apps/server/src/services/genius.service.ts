import type { Env } from '../types';

interface GeniusSong {
  id: number;
  title: string;
  url: string;
  primary_artist: {
    id: number;
    name: string;
  };
  album?: {
    id: number;
    name: string;
  };
  song_art_image_url?: string;
  language?: string;
  media?: Array<{
    provider: string;
    type: string;
    url: string;
  }>;
}

interface GeniusSearchResponse {
  response: {
    hits: Array<{
      type: string;
      result: GeniusSong;
    }>;
  };
}

interface GeniusSongResponse {
  response: {
    song: GeniusSong;
  };
}

export class GeniusService {
  private baseUrl = 'https://api.genius.com';

  constructor(private apiKey: string) {}

  async searchSongs(query: string): Promise<GeniusSong[]> {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      console.warn('[Genius] No API key configured');
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Genius API error: ${response.status}`);
      }

      const data = (await response.json()) as GeniusSearchResponse;
      return data.response.hits
        .filter((hit) => hit.type === 'song')
        .map((hit) => hit.result);
    } catch (error) {
      console.error('[Genius] Search error:', error);
      return [];
    }
  }

  async getSongById(songId: number): Promise<GeniusSong | null> {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/songs/${songId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Genius API error: ${response.status}`);
      }

      const data = (await response.json()) as GeniusSongResponse;
      return data.response.song;
    } catch (error) {
      console.error('[Genius] Get song error:', error);
      return null;
    }
  }

  async findSongMatch(
    query: string,
    trackId: string
  ): Promise<{
    found: boolean;
    song: GeniusSong | null;
    confidence: number;
  }> {
    const songs = await this.searchSongs(query);
    if (songs.length === 0) {
      return { found: false, song: null, confidence: 0 };
    }

    // Check for SoundCloud URL match (highest confidence)
    for (const song of songs) {
      if (song.media) {
        const soundcloudMatch = song.media.some(
          (media) =>
            media.provider === 'soundcloud' &&
            media.url &&
            (media.url.includes(trackId) || trackId.includes(media.url))
        );

        if (soundcloudMatch) {
          return { found: true, song, confidence: 0.95 };
        }
      }
    }

    // Return first result with lower confidence
    const firstSong = songs[0];
    if (this.isLikelyTranslation(firstSong.title, query)) {
      return { found: false, song: null, confidence: 0 };
    }

    return { found: true, song: firstSong, confidence: 0.7 };
  }

  async findVideoMatch(
    query: string,
    trackId: string
  ): Promise<{
    found: boolean;
    song: GeniusSong | null;
    confidence: number;
  }> {
    const songs = await this.searchSongs(query);
    if (songs.length === 0) {
      return { found: false, song: null, confidence: 0 };
    }

    // Need to get full song details to check media links
    for (const searchResult of songs.slice(0, 5)) { // Check top 5 results
      const fullSong = await this.getSongById(searchResult.id);
      if (fullSong && fullSong.media) {
        const soundcloudMatch = fullSong.media.some(
          (media) =>
            media.provider === 'soundcloud' &&
            media.url &&
            (media.url.includes(trackId) || trackId.includes(media.url))
        );

        if (soundcloudMatch) {
          return { found: true, song: fullSong, confidence: 0.95 };
        }
      }
    }

    // Return first result with lower confidence
    const firstSong = songs[0];
    if (this.isLikelyTranslation(firstSong.title, query)) {
      return { found: false, song: null, confidence: 0 };
    }

    return { found: true, song: firstSong, confidence: 0.7 };
  }

  private isLikelyTranslation(title: string, query: string): boolean {
    const translationKeywords = [
      'translation',
      'tradução',
      'traducción',
      'traduction',
      'übersetzung',
      '翻訳',
      '번역',
    ];

    const lowerTitle = title.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Check if title contains translation keywords
    if (translationKeywords.some((keyword) => lowerTitle.includes(keyword))) {
      return true;
    }

    // Check if title is significantly different from query (likely different language)
    const queryWords = lowerQuery.split(/\s+/);
    const titleWords = lowerTitle.split(/\s+/);
    const commonWords = queryWords.filter((word) =>
      titleWords.some((titleWord) => titleWord.includes(word) || word.includes(titleWord))
    );

    return commonWords.length < queryWords.length / 2;
  }
}

// Factory function for creating Genius service
export function createGeniusService(env: Env): GeniusService {
  return new GeniusService(env.GENIUS_API_KEY || 'demo-key');
}