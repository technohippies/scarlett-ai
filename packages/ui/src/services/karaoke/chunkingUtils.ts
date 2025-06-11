import type { ChunkInfo } from '../../types/karaoke';
import type { LyricLine } from '../../components/karaoke/LyricsDisplay';

const MIN_WORDS = 8;
const MAX_WORDS = 15;
const MAX_LINES_PER_CHUNK = 3;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function shouldChunkLines(
  lines: LyricLine[],
  startIndex: number
): ChunkInfo {
  let totalWords = 0;
  let endIndex = startIndex;
  const expectedTexts: string[] = [];

  while (endIndex < lines.length && totalWords < MIN_WORDS) {
    const line = lines[endIndex];
    if (!line) break;
    
    const words = countWords(line.text);

    if (totalWords + words > MAX_WORDS && totalWords >= 5) {
      break;
    }

    expectedTexts.push(line.text);
    totalWords += words;
    endIndex++;

    if (endIndex - startIndex >= MAX_LINES_PER_CHUNK) break;
  }

  return {
    startIndex,
    endIndex: endIndex - 1,
    expectedText: expectedTexts.join(' '),
    wordCount: totalWords,
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