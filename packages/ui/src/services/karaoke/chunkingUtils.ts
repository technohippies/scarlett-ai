import type { KaraokeLine, ChunkInfo } from '../../types/karaoke';

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
  lines: KaraokeLine[],
  startIndex: number
): ChunkInfo {
  let totalWords = 0;
  let endIndex = startIndex;
  const expectedTexts: string[] = [];

  while (endIndex < lines.length && totalWords < MIN_WORDS) {
    const line = lines[endIndex];
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
  lines: KaraokeLine[],
  chunkInfo: ChunkInfo
): number {
  const { startIndex, endIndex } = chunkInfo;
  const line = lines[startIndex];
  
  if (!line) return 3000;

  if (endIndex > startIndex) {
    const lastLine = lines[endIndex];
    
    if (line.recordingStart && lastLine.recordingEnd) {
      return lastLine.recordingEnd - line.recordingStart;
    } else if (endIndex + 1 < lines.length) {
      const nextLine = lines[endIndex + 1];
      return nextLine.timestamp - line.timestamp;
    } else {
      let duration = 0;
      for (let i = startIndex; i <= endIndex; i++) {
        duration += lines[i].duration || 3000;
      }
      return Math.min(duration, 8000);
    }
  } else {
    if (line.recordingStart && line.recordingEnd) {
      return line.recordingEnd - line.recordingStart;
    } else if (startIndex + 1 < lines.length) {
      const nextLine = lines[startIndex + 1];
      const calculatedDuration = nextLine.timestamp - line.timestamp;
      return Math.min(Math.max(calculatedDuration, 1000), 5000);
    } else {
      return Math.min(line.duration || 3000, 5000);
    }
  }
}