/**
 * Services Index
 *
 * Central export point for all API services
 */

export {
  GeniusService,
  type GeniusSong,
  type VideoMatchResult,
} from './genius.js';
export {
  LRCLibService,
  type LyricsQuery,
  type LyricsMetadata,
  type SyncedLyricLine,
  type UnsyncedLyricLine,
} from './lrclib.js';
