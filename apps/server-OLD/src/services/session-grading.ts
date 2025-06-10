/**
 * Session Grading Service
 *
 * Handles grading of full karaoke sessions by aligning
 * complete transcripts with lyrics using word-level timing
 */

import type { LyricLine } from './lyrics';
import type { LineResult } from './scoring';
import type {
  ElevenLabsResponse,
  ElevenLabsWord,
  ForcedAlignmentResponse,
} from './stt';
import { calculateKaraokeScore } from './scoring';

export interface SessionGradingResult {
  lineResults: LineResult[];
  overallScore: number;
  totalLines: number;
  transcribedLines: number;
}

/**
 * Align a full transcript with lyrics using word-level timing
 */
export function alignTranscriptToLyrics(
  transcript: ElevenLabsResponse,
  lyrics: LyricLine[]
): LineResult[] {
  console.log('[SessionGrading] Starting alignment...');
  console.log(
    `[SessionGrading] Transcript has ${transcript.words.length} words`
  );
  console.log(
    `[SessionGrading] Full transcript: "${transcript.text.substring(0, 200)}..."`
  );
  console.log(`[SessionGrading] Lyrics have ${lyrics.length} lines`);

  // Debug: Check word structure and timing
  if (transcript.words.length > 0) {
    console.log('[SessionGrading] First 10 words:');
    transcript.words.slice(0, 10).forEach((w, i) => {
      console.log(
        `  ${i}: "${w.text}" [${w.type || 'no-type'}] ${w.start?.toFixed(2)}s-${w.end?.toFixed(2)}s`
      );
    });
  }

  const results: LineResult[] = [];

  // Process each lyric line
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const lineStartMs = line.timestamp; // Keep in milliseconds
    const lineEndMs = lineStartMs + (line.duration || 3000);

    // Add buffer to account for early/late singing
    const bufferBeforeMs = i === 0 ? 1000 : 500; // More buffer for first line (in ms)
    const bufferAfterMs = 500;

    // Debug: Log timing window
    console.log(
      `[SessionGrading] Line ${i} window: ${(lineStartMs - bufferBeforeMs) / 1000}s - ${(lineEndMs + bufferAfterMs) / 1000}s`
    );

    // Find all words that fall within this line's time window
    const wordsInWindow = transcript.words.filter((w) => {
      // Skip if no timing data (check for undefined/null, not falsy)
      if (
        w.start === undefined ||
        w.start === null ||
        w.end === undefined ||
        w.end === null
      ) {
        return false;
      }

      // Include all tokens for now - we'll filter when joining
      // (ElevenLabs includes words, spaces, and punctuation as separate tokens)

      // ElevenLabs returns timing in seconds, convert to milliseconds
      const wordStartMs = w.start * 1000;
      const wordEndMs = w.end * 1000;
      const wordMidpointMs = (wordStartMs + wordEndMs) / 2;

      // Debug first few words
      if (transcript.words.indexOf(w) < 5) {
        console.log(
          `[SessionGrading] Word "${w.text}" timing: ${wordStartMs.toFixed(0)}-${wordEndMs.toFixed(0)}ms (midpoint: ${wordMidpointMs.toFixed(0)}ms)`
        );
      }

      // Check if word timing overlaps with line timing (with buffer)
      return (
        wordMidpointMs >= lineStartMs - bufferBeforeMs &&
        wordMidpointMs < lineEndMs + bufferAfterMs
      );
    });

    // Join the words to create the spoken text
    // ElevenLabs includes both words and spacing tokens, so we need to reconstruct properly
    let spokenText = '';
    for (const w of wordsInWindow) {
      if (w.text) {
        spokenText += w.text;
      }
    }
    spokenText = spokenText.trim();

    // Calculate score for this line
    const score = calculateKaraokeScore(line.text, spokenText, 1);

    console.log(
      `[SessionGrading] Line ${i}: "${line.text}" ` +
        `(${(lineStartMs / 1000).toFixed(1)}-${(lineEndMs / 1000).toFixed(1)}s) ` +
        `→ "${spokenText}" (${wordsInWindow.length} words) ` +
        `Score: ${score}`
    );

    results.push({
      expected: line.text,
      spoken: spokenText,
      score,
    });
  }

  return results;
}

/**
 * Calculate overall session score from line results
 */
export function calculateOverallScore(
  lineResults: LineResult[]
): SessionGradingResult {
  const transcribedLines = lineResults.filter((r) => r.spoken.length > 0);

  if (transcribedLines.length === 0) {
    return {
      lineResults,
      overallScore: 0,
      totalLines: lineResults.length,
      transcribedLines: 0,
    };
  }

  // Calculate weighted average (lines with more words have more weight)
  let totalWeight = 0;
  let weightedScore = 0;

  for (const result of transcribedLines) {
    const wordCount = result.expected
      .split(' ')
      .filter((w) => w.length > 0).length;
    const weight = Math.max(1, wordCount); // Minimum weight of 1

    totalWeight += weight;
    weightedScore += result.score * weight;
  }

  const overallScore = Math.round(weightedScore / totalWeight);

  console.log(
    `[SessionGrading] Overall: ${transcribedLines.length}/${lineResults.length} lines, ` +
      `Score: ${overallScore}`
  );

  return {
    lineResults,
    overallScore,
    totalLines: lineResults.length,
    transcribedLines: transcribedLines.length,
  };
}

/**
 * Find the best offset if user is consistently ahead/behind the beat
 */
export function findTimingOffset(
  transcript: ElevenLabsResponse,
  lyrics: LyricLine[]
): number {
  // This is a simplified version - could be enhanced with DTW or similar
  const offsets: number[] = [];

  for (const line of lyrics) {
    if (!line.text || line.text.trim() === '') continue; // Skip empty lines

    const lineStartSec = line.timestamp / 1000;
    const expectedFirstWord = line.text.split(' ')[0].toLowerCase();

    // Find the first occurrence of this word in the transcript
    const matchingWord = transcript.words.find(
      (w) =>
        (!w.type || w.type === 'word') && // Handle missing type field
        w.text && // Ensure text exists
        w.text.toLowerCase().includes(expectedFirstWord)
    );

    if (matchingWord && matchingWord.start !== undefined) {
      const offset = matchingWord.start - lineStartSec; // Both in seconds
      if (Math.abs(offset) < 5) {
        // Ignore offsets > 5 seconds
        offsets.push(offset);
      }
    }
  }

  if (offsets.length === 0) return 0;

  // Return median offset
  offsets.sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)];

  console.log(`[SessionGrading] Detected timing offset: ${median.toFixed(2)}s`);
  return median;
}

/**
 * Enhanced alignment with timing offset correction
 */
export function alignTranscriptWithOffset(
  transcript: ElevenLabsResponse,
  lyrics: LyricLine[]
): LineResult[] {
  // First, detect if user is consistently ahead/behind
  const timingOffset = findTimingOffset(transcript, lyrics);

  // Adjust transcript timings if significant offset detected
  if (Math.abs(timingOffset) > 0.3) {
    console.log(
      `[SessionGrading] Applying timing correction of ${timingOffset.toFixed(2)}s`
    );

    // Create adjusted transcript
    const adjustedTranscript: ElevenLabsResponse = {
      ...transcript,
      words: transcript.words.map((w) => ({
        ...w,
        start: w.start - timingOffset,
        end: w.end - timingOffset,
      })),
    };

    return alignTranscriptToLyrics(adjustedTranscript, lyrics);
  }

  // No significant offset, use original
  return alignTranscriptToLyrics(transcript, lyrics);
}

/**
 * Hybrid grading using stored line results and forced alignment
 */
export async function gradeSessionWithHybridApproach(
  sessionId: string,
  forcedAlignment: ForcedAlignmentResponse,
  lyrics: LyricLine[],
  getLineResults: (sessionId: string) => Promise<any[]>
): Promise<SessionGradingResult> {
  console.log('[SessionGrading] Using hybrid approach with forced alignment');

  // Get the stored line-by-line results from Deepgram
  const storedLineResults = await getLineResults(sessionId);
  console.log(
    `[SessionGrading] Retrieved ${storedLineResults.length} stored line results`
  );

  // Create a map of line index to forced alignment words
  const alignmentByLine = new Map<
    number,
    (typeof forcedAlignment.words)[0][]
  >();

  // Assign forced alignment words to lines based on timing
  let currentLineIdx = 0;
  for (const word of forcedAlignment.words) {
    // Find which line this word belongs to based on timing
    while (currentLineIdx < lyrics.length - 1) {
      const currentLine = lyrics[currentLineIdx];
      const nextLine = lyrics[currentLineIdx + 1];

      const wordMidpoint = (word.start + word.end) / 2;
      const currentEnd =
        (currentLine.timestamp + (currentLine.duration || 3000)) / 1000;
      const nextStart = nextLine.timestamp / 1000;

      // If word is closer to next line, advance
      if (wordMidpoint > (currentEnd + nextStart) / 2) {
        currentLineIdx++;
      } else {
        break;
      }
    }

    // Add word to current line's collection
    if (!alignmentByLine.has(currentLineIdx)) {
      alignmentByLine.set(currentLineIdx, []);
    }
    alignmentByLine.get(currentLineIdx)!.push(word);
  }

  // Build final results combining stored transcripts with precise timing
  const lineResults: LineResult[] = [];

  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const storedResult = storedLineResults.find((r) => r.line_index === i);
    const alignmentWords = alignmentByLine.get(i) || [];

    if (storedResult) {
      // Use the actual transcript from Deepgram
      lineResults.push({
        expected: line.text,
        spoken: storedResult.transcribed_text || '',
        score: storedResult.score || 0,
        // Add timing quality metric
        timingQuality: calculateTimingQuality(alignmentWords, line),
      } as LineResult);
    } else {
      // Line was not recorded/graded
      lineResults.push({
        expected: line.text,
        spoken: '',
        score: 15, // Minimum score for non-singing
      });
    }
  }

  return calculateOverallScore(lineResults);
}

/**
 * Calculate how well the timing matched
 */
function calculateTimingQuality(
  alignmentWords: any[],
  lyricLine: LyricLine
): number {
  if (alignmentWords.length === 0) return 0;

  const lineStartSec = lyricLine.timestamp / 1000;
  const lineEndSec = lineStartSec + (lyricLine.duration || 3000) / 1000;

  // Calculate what percentage of words fall within the expected time window
  const wordsInWindow = alignmentWords.filter((w) => {
    const wordMidpoint = (w.start + w.end) / 2;
    return wordMidpoint >= lineStartSec && wordMidpoint <= lineEndSec;
  });

  return wordsInWindow.length / alignmentWords.length;
}
