/**
 * Lyrics Processing Service
 *
 * Handles processing and timing adjustments for karaoke lyrics
 */

export interface LyricLine {
  text: string;
  timestamp: number; // milliseconds
  duration?: number; // milliseconds
  recordingStart?: number; // seconds
  recordingEnd?: number; // seconds
  recordingDuration?: number; // seconds
}

/**
 * Clean lyrics text by removing metadata and normalizing format
 */
export function cleanLyricsText(text: string): string {
  return (
    text
      // Remove timing codes like [00:00.00]
      .replace(/\[\d{2}:\d{2}\.\d{2}\]/g, '')
      // Remove metadata tags like [ar:Artist]
      .replace(/\[(ar|ti|al|by|offset|id):[^\]]*\]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Process synced lyrics with timing improvements for karaoke
 */
export function processSyncedLyrics(rawLyrics: any[]): LyricLine[] {
  console.log(
    '[Timing] Processing synced lyrics with improved start buffer (500ms, 700ms for first line)...'
  );

  const LATENCY_BUFFER = 0.3; // 300ms buffer for network latency only
  const MIN_PRACTICAL_DURATION = 0.6; // Minimum 600ms for any line
  const MAX_DURATION = 4.0; // Maximum 4 seconds per line
  const RECORDING_START_BUFFER = 0.5; // 500ms buffer before line starts
  const RECORDING_END_OFFSET = 0.2; // Stop recording 200ms before line ends
  const WORDS_PER_SECOND = 3.0; // Average singing speed: ~3 words per second

  const processed: LyricLine[] = [];

  // Check if we have valid timestamps
  const hasValidTimestamps = rawLyrics.some(
    (line) =>
      line.startTime !== undefined &&
      line.startTime !== null &&
      line.startTime > 0
  );

  if (!hasValidTimestamps) {
    console.warn(
      '[Timing] WARNING: No valid timestamps found in synced lyrics!'
    );
    console.log('[Timing] First line data:', rawLyrics[0]);
  }

  for (let i = 0; i < rawLyrics.length; i++) {
    const currentLine = rawLyrics[i];
    const nextLine = rawLyrics[i + 1];

    if (!currentLine.text || currentLine.text.trim() === '') {
      continue;
    }

    const text = currentLine.text.trim();
    // Check if startTime is in seconds (< 1000) or milliseconds (>= 1000)
    let startTime: number;
    if (currentLine.startTime < 1000) {
      // Already in seconds (e.g., 0.06, 2.22)
      startTime = currentLine.startTime || 0;
      console.log(
        `[Timing] Line ${i}: startTime appears to be in seconds: ${startTime}`
      );
    } else {
      // In milliseconds, convert to seconds
      startTime = (currentLine.startTime || 0) / 1000;
    }
    const wordCount = text
      .split(' ')
      .filter((w: string) => w.length > 0).length;

    // Calculate duration based on next line or word count
    let duration: number;
    let endTime: number;

    if (nextLine && nextLine.startTime !== undefined) {
      // Apply same conversion logic for next line
      let nextStartTime: number;
      if (nextLine.startTime < 1000) {
        nextStartTime = nextLine.startTime;
      } else {
        nextStartTime = nextLine.startTime / 1000;
      }
      duration = Math.max(
        MIN_PRACTICAL_DURATION,
        nextStartTime - startTime - 0.1
      );
      endTime = startTime + duration;
    } else {
      const estimatedDuration = Math.max(
        MIN_PRACTICAL_DURATION,
        wordCount / WORDS_PER_SECOND
      );
      duration = Math.min(estimatedDuration, MAX_DURATION);
      endTime = startTime + duration;
    }

    // Apply maximum duration cap
    if (duration > MAX_DURATION) {
      console.log(
        `[Timing] Capping line ${i} duration from ${duration.toFixed(2)}s to ${MAX_DURATION}s`
      );
      duration = MAX_DURATION;
      endTime = startTime + duration;
    }

    // Adjust duration if it would overlap with next line
    if (nextLine && nextLine.startTime !== undefined) {
      // Apply same conversion logic for overlap check
      let nextStartTime: number;
      if (nextLine.startTime < 1000) {
        nextStartTime = nextLine.startTime;
      } else {
        nextStartTime = nextLine.startTime / 1000;
      }
      if (endTime > nextStartTime - 0.1) {
        endTime = nextStartTime - 0.1;
        duration = Math.max(MIN_PRACTICAL_DURATION, endTime - startTime); // Ensure minimum duration
        console.log(
          `[Timing] Adjusted line ${i} to avoid overlap: ${duration.toFixed(2)}s`
        );
      }
    }

    // Safety check: ensure duration is never negative
    if (duration <= 0) {
      console.log(
        `[Timing] Warning: Line ${i} had invalid duration ${duration.toFixed(2)}s, setting to minimum`
      );
      duration = MIN_PRACTICAL_DURATION;
      endTime = startTime + duration;
    }

    // Calculate recording window with padding
    const isFirstLine = i === 0;
    const startBuffer = isFirstLine ? 0.7 : RECORDING_START_BUFFER;
    const recordingStart = Math.max(0, startTime - startBuffer);
    const recordingEnd = Math.max(
      startTime + 0.5,
      endTime - RECORDING_END_OFFSET
    );
    const recordingDuration = recordingEnd - recordingStart;

    // Log significant recording adjustments
    if (recordingDuration < duration - 0.3) {
      console.log(
        `[Timing] Line ${i}: Recording window significantly shorter than display (${recordingDuration.toFixed(2)}s vs ${duration.toFixed(2)}s)`
      );
    }

    // Apply network latency buffer to display timing
    const displayStartTime = Math.max(0, startTime - LATENCY_BUFFER);

    processed.push({
      text,
      timestamp: displayStartTime * 1000, // Convert back to milliseconds
      duration: duration * 1000,
      recordingStart,
      recordingEnd,
      recordingDuration,
    });
  }

  console.log('[Timing] Processed lyrics with recording windows:', {
    totalLines: processed.length,
    averageDuration: (
      processed.reduce((sum, l) => sum + (l.duration || 0), 0) /
      processed.length /
      1000
    ).toFixed(2),
    averageRecordingDuration: (
      processed.reduce((sum, l) => sum + (l.recordingDuration || 0), 0) /
      processed.length
    ).toFixed(2),
  });

  return processed;
}

/**
 * Merge short lines for better karaoke experience
 */
export function mergeShortLines(lines: LyricLine[]): LyricLine[] {
  const MIN_LINE_DURATION = 1.5; // seconds
  const merged: LyricLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];
    const duration = (current.duration || 0) / 1000;

    if (duration < MIN_LINE_DURATION && i < lines.length - 1) {
      const next = lines[i + 1];
      const combinedText = `${current.text} ${next.text}`;
      const combinedDuration = (current.duration || 0) + (next.duration || 0);

      merged.push({
        ...current,
        text: combinedText,
        duration: combinedDuration,
        recordingEnd: next.recordingEnd,
        recordingDuration:
          (next.recordingEnd || 0) - (current.recordingStart || 0),
      });
      i += 2;
    } else {
      merged.push(current);
      i++;
    }
  }

  console.log(`[Timing] Merged ${lines.length} lines into ${merged.length}`);
  return merged;
}

/**
 * Convert lyrics to simple format for client
 */
export function formatLyricsForClient(lyrics: LyricLine[]) {
  return {
    type: 'synced',
    lines: lyrics.map((line) => ({
      text: line.text,
      timestamp: line.timestamp,
      duration: line.duration,
      recordingStart: line.recordingStart,
      recordingEnd: line.recordingEnd,
      recordingDuration: line.recordingDuration,
    })),
  };
}

/**
 * Estimate timing for unsynced lyrics
 */
export function estimateTimingForUnsyncedLyrics(
  lyrics: Array<{ text: string }>,
  songDurationMs?: number
): LyricLine[] {
  const WORDS_PER_SECOND = 2.5;
  const MIN_LINE_DURATION = 2000; // 2 seconds minimum
  const GAP_BETWEEN_LINES = 500; // 0.5 second gap

  let currentTime = 1000; // Start at 1 second
  const processed: LyricLine[] = [];

  for (const line of lyrics) {
    const wordCount = line.text
      .split(' ')
      .filter((w: string) => w.length > 0).length;
    const estimatedDuration = Math.max(
      MIN_LINE_DURATION,
      (wordCount / WORDS_PER_SECOND) * 1000
    );

    processed.push({
      text: line.text,
      timestamp: currentTime,
      duration: estimatedDuration,
    });

    currentTime += estimatedDuration + GAP_BETWEEN_LINES;
  }

  // If we have song duration, scale the timings to fit
  if (songDurationMs && currentTime > songDurationMs) {
    const scaleFactor = songDurationMs / currentTime;
    for (const line of processed) {
      line.timestamp *= scaleFactor;
      if (line.duration) {
        line.duration *= scaleFactor;
      }
    }
  }

  return processed;
}
