import { findLyrics, searchLyrics } from 'lrclib-api';
import type { LyricsLine } from '../types';

interface LRCLibSearchParams {
  track_name: string;
  artist_name: string;
  album_name?: string;
  duration?: number;
}


interface LRCLine {
  startTime: number;
  text: string;
}

interface SuccessInfo {
  method: 'direct' | 'genius';
  timestamp: number;
  metadata?: {
    geniusId?: string;
    artistName?: string;
    trackName?: string;
  };
}

export class LyricsService {
  private static failureCache = new Map<string, number>();
  private static successCache = new Map<string, SuccessInfo>();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static SUCCESS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for successful lookups

  constructor() {}

  async searchLyrics(params: LRCLibSearchParams, options?: { skipCache?: boolean }): Promise<{
    type: 'synced' | 'unsynced' | 'none';
    lyrics: LRCLine[];
    metadata?: { duration?: number };
    fromCache?: boolean;
  }> {
    // Generate cache key
    const cacheKey = `${params.artist_name}:${params.track_name}`.toLowerCase();
    
    // Check caches unless explicitly skipped
    if (!options?.skipCache) {
      // Check failure cache first
      const cachedFailure = LyricsService.failureCache.get(cacheKey);
      if (cachedFailure && Date.now() - cachedFailure < LyricsService.CACHE_DURATION) {
        console.log(`[LyricsService] Skipping search for "${params.track_name}" - recently failed`);
        return { type: 'none', lyrics: [], fromCache: true };
      }
    }

    try {
      // Try search endpoint first - it's more flexible than exact match
      const searchResults = await searchLyrics(params);
      if (searchResults && searchResults.length > 0) {
        const bestMatch = searchResults[0];
        if (bestMatch.syncedLyrics) {
          const parsed = this.parseLRCString(bestMatch.syncedLyrics);
          if (parsed.length > 0) {
            // Cache successful direct search
            this.cacheSuccess(cacheKey, 'direct');
            return {
              type: 'synced',
              lyrics: parsed,
              metadata: { duration: bestMatch.duration },
            };
          }
        }

        // Return unsynced lyrics if available
        if (bestMatch.plainLyrics) {
          const lines = bestMatch.plainLyrics
            .split('\n')
            .filter((line) => line.trim())
            .map((text, index) => ({
              startTime: index * 3, // Estimate 3 seconds per line
              text: text.trim(),
            }));

          // Cache successful direct search
          this.cacheSuccess(cacheKey, 'direct');
          return {
            type: 'unsynced',
            lyrics: lines,
            metadata: { duration: bestMatch.duration },
          };
        }
      }

      // Only try exact match if search didn't work
      const syncedResult = await findLyrics(params);
      if (syncedResult && syncedResult.syncedLyrics) {
        const parsed = this.parseLRCString(syncedResult.syncedLyrics);
        if (parsed.length > 0) {
          // Cache successful direct search
          this.cacheSuccess(cacheKey, 'direct');
          return {
            type: 'synced',
            lyrics: parsed,
            metadata: { duration: syncedResult.duration },
          };
        }
      }

      // Cache this failure
      LyricsService.failureCache.set(cacheKey, Date.now());
      return { type: 'none', lyrics: [] };
    } catch (error) {
      // Better error logging to diagnose the "Unknown error" issue
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof Error ? {
        message: error.message,
        stack: error.stack?.split('\n')[0],
        name: error.name
      } : { raw: error };
      
      if (!errorMessage.includes("Track wasn't found")) {
        console.error('[LyricsService] Unexpected error:', errorDetails);
      }
      
      // Cache this failure
      LyricsService.failureCache.set(cacheKey, Date.now());
      return { type: 'none', lyrics: [] };
    }
  }

  processSyncedLyrics(lyrics: LRCLine[]): LyricsLine[] {
    const processed: LyricsLine[] = [];

    for (let i = 0; i < lyrics.length; i++) {
      const currentLine = lyrics[i];
      const nextLine = lyrics[i + 1];

      // Calculate duration based on next line or estimate
      const duration = nextLine
        ? (nextLine.startTime - currentLine.startTime) * 1000
        : 3000; // Default 3 seconds for last line

      // Add buffer time for recording
      const recordingBuffer = 300; // 300ms before line starts
      const recordingStart = Math.max(0, currentLine.startTime * 1000 - recordingBuffer);
      const recordingEnd = currentLine.startTime * 1000 + duration;

      processed.push({
        id: i,
        timestamp: currentLine.startTime * 1000,
        text: this.cleanLyricsText(currentLine.text),
        duration,
        startTime: currentLine.startTime,
        endTime: currentLine.startTime + duration / 1000,
        recordingStart,
        recordingEnd,
      });
    }

    // Merge short lines for better UX
    return this.mergeShortLines(processed);
  }

  private parseLRCString(lrcString: string): LRCLine[] {
    if (!lrcString) return [];

    const lines: LRCLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    lrcString.split('\n').forEach((line) => {
      const matches = [...line.matchAll(timeRegex)];
      if (matches.length > 0) {
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          matches.forEach((match) => {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
            const startTime = minutes * 60 + seconds + milliseconds / 1000;
            lines.push({ startTime, text });
          });
        }
      }
    });

    return lines.sort((a, b) => a.startTime - b.startTime);
  }

  private createTitleVariants(title: string): string[] {
    const variants = new Set<string>();
    
    // Original title
    variants.add(title);
    
    // Remove parenthetical content
    variants.add(title.replace(/\([^)]*\)/g, '').trim());
    
    // Remove everything after hyphen
    variants.add(title.split('-')[0].trim());
    
    // Remove featuring artists
    variants.add(title.replace(/\s*(feat\.|ft\.|featuring)\s*.*/i, '').trim());
    
    // Remove common suffixes
    const suffixes = ['Remix', 'Version', 'Edit', 'Mix', 'Remaster', 'Live'];
    suffixes.forEach((suffix) => {
      const regex = new RegExp(`\\s*\\(?${suffix}.*\\)?`, 'i');
      variants.add(title.replace(regex, '').trim());
    });

    return Array.from(variants).filter((v) => v && v !== title);
  }

  private cleanLyricsText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?'-]/g, '')
      .trim();
  }

  private mergeShortLines(lines: LyricsLine[]): LyricsLine[] {
    const merged: LyricsLine[] = [];
    let i = 0;

    while (i < lines.length) {
      const current = lines[i];
      
      // Check if current line is very short and next line exists
      if (current.text.length < 20 && i + 1 < lines.length) {
        const next = lines[i + 1];
        
        // If combined length is reasonable, merge them
        if (current.text.length + next.text.length < 60) {
          merged.push({
            ...current,
            text: `${current.text} ${next.text}`,
            duration: current.duration + next.duration,
            endTime: next.endTime,
            recordingEnd: next.recordingEnd,
          });
          i += 2; // Skip next line
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Re-index the lines
    return merged.map((line, index) => ({ ...line, id: index }));
  }

  private cacheSuccess(cacheKey: string, method: 'direct' | 'genius', metadata?: SuccessInfo['metadata']): void {
    LyricsService.successCache.set(cacheKey, {
      method,
      timestamp: Date.now(),
      metadata
    });
    // Also remove from failure cache if present
    LyricsService.failureCache.delete(cacheKey);
    console.log(`[LyricsService] Cached successful ${method} lookup for key: ${cacheKey}`);
  }

  static getSuccessInfo(artist: string, track: string): SuccessInfo | null {
    const cacheKey = `${artist}:${track}`.toLowerCase();
    const cached = LyricsService.successCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < LyricsService.SUCCESS_CACHE_DURATION) {
      return cached;
    }
    
    // Clean up expired entry
    if (cached) {
      LyricsService.successCache.delete(cacheKey);
    }
    
    return null;
  }

  static cacheGeniusSuccess(artist: string, track: string, metadata?: SuccessInfo['metadata']): void {
    const cacheKey = `${artist}:${track}`.toLowerCase();
    const service = new LyricsService();
    service.cacheSuccess(cacheKey, 'genius', metadata);
  }
}