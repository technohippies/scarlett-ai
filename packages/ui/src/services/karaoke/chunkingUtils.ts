import type { ChunkInfo } from '@scarlett/core';
import type { LyricLine } from '../../components/karaoke/LyricsDisplay';

export function countWords(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function shouldChunkLines(
  lines: LyricLine[],
  startIndex: number
): ChunkInfo {
  // Process individual lines instead of grouping
  const line = lines[startIndex];
  if (!line) {
    return {
      startIndex,
      endIndex: startIndex,
      expectedText: '',
      wordCount: 0,
    };
  }

  const wordCount = countWords(line.text || '');
  
  return {
    startIndex,
    endIndex: startIndex, // Single line, so start and end are the same
    expectedText: line.text || '',
    wordCount,
  };
}

export function calculateRecordingDuration(
  lines: LyricLine[],
  chunkInfo: ChunkInfo
): number {
  const { startIndex, endIndex } = chunkInfo;
  const line = lines[startIndex];
  
  if (!line) return 3000;

  if (endIndex > startIndex) {
    if (endIndex + 1 < lines.length) {
      const nextLine = lines[endIndex + 1];
      if (nextLine) {
        // Convert seconds to milliseconds
        return (nextLine.startTime - line.startTime) * 1000;
      }
    }
    
    let duration = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      // duration is already in milliseconds
      duration += lines[i]?.duration || 3000;
    }
    return Math.min(duration, 8000);
  } else {
    if (startIndex + 1 < lines.length) {
      const nextLine = lines[startIndex + 1];
      if (nextLine) {
        // Convert seconds to milliseconds
        const calculatedDuration = (nextLine.startTime - line.startTime) * 1000;
        return Math.min(Math.max(calculatedDuration, 1000), 5000);
      }
    }
    
    return Math.min(line.duration || 3000, 5000);
  }
}