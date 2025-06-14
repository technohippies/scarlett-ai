import { For, createEffect, createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { interactiveListItemStyles } from '../../../utils/interactiveListStyles';

export interface LyricLine {
  id: string;
  text: string;
  startTime: number; // in seconds
  duration: number; // in milliseconds
}

export interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentTime?: number; // in milliseconds
  isPlaying?: boolean;
  lineScores?: Array<{ lineIndex: number; score: number; transcription: string; feedback?: string }>;
  onLyricClick?: (lyric: LyricLine, index: number) => void;
  class?: string;
}

export const LyricsDisplay: Component<LyricsDisplayProps> = (props) => {
  const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;
  
  // Helper to get score for a line
  const getLineScore = (lineIndex: number) => {
    return props.lineScores?.find(s => s.lineIndex === lineIndex)?.score || null;
  };
  
  // Helper to get color based on score
  const getScoreStyle = (score: number | null) => {
    if (score === null) return {};
    
    // Simple color changes only - no animations or effects
    if (score >= 95) {
      return { color: '#ff3838' };
    } else if (score >= 90) {
      return { color: '#ff6b6b' };
    } else if (score >= 80) {
      return { color: '#ff8787' };
    } else if (score >= 70) {
      return { color: '#ffa8a8' };
    } else if (score >= 60) {
      return { color: '#ffcece' };
    } else {
      return { color: '#ffe0e0' };
    }
  };
  
  // Removed emoji function - using colors only

  // Find current line based on time
  createEffect(() => {
    if (!props.currentTime || !props.lyrics.length) {
      setCurrentLineIndex(-1);
      return;
    }

    const time = props.currentTime / 1000; // Convert from milliseconds to seconds
    const TIMING_OFFSET = 0.3; // Offset to make lyrics appear 0.3s earlier
    const adjustedTime = time + TIMING_OFFSET;
    
    // Find the line that contains the current time
    let foundIndex = -1;
    for (let i = 0; i < props.lyrics.length; i++) {
      const line = props.lyrics[i];
      if (!line) continue;
      const endTime = line.startTime + line.duration / 1000; // Convert duration from ms to seconds
      
      if (adjustedTime >= line.startTime && adjustedTime < endTime) {
        foundIndex = i;
        break;
      }
    }
    
    // If no line contains current time, find the most recent past line
    if (foundIndex === -1 && time > 0) {
      for (let i = props.lyrics.length - 1; i >= 0; i--) {
        const line = props.lyrics[i];
        if (!line) continue;
        if (time >= line.startTime) {
          foundIndex = i;
          break;
        }
      }
    }
    
    // Only update if the index has changed to avoid unnecessary scrolling
    if (foundIndex !== currentLineIndex()) {
      const prevIndex = currentLineIndex();
      // Only log large jumps to reduce console spam
      if (Math.abs(foundIndex - prevIndex) > 5) {
        console.log('[LyricsDisplay] Current line changed:', {
          from: prevIndex,
          to: foundIndex,
          time: props.currentTime,
          timeInSeconds: time,
          jump: Math.abs(foundIndex - prevIndex)
        });
      }
      
      // Log warning for large jumps
      if (prevIndex !== -1 && Math.abs(foundIndex - prevIndex) > 10) {
        console.warn('[LyricsDisplay] Large line jump detected!', {
          from: prevIndex,
          to: foundIndex,
          fromLine: props.lyrics[prevIndex],
          toLine: props.lyrics[foundIndex]
        });
      }
      
      setCurrentLineIndex(foundIndex);
    }
  });

  // Auto-scroll to current line
  createEffect(() => {
    const index = currentLineIndex();
    if (index === -1 || !containerRef || !props.isPlaying) return;

    const lineElements = containerRef.querySelectorAll('[data-line-index]');
    const currentElement = lineElements[index] as HTMLElement;

    if (currentElement) {
      const containerHeight = containerRef.clientHeight;
      const lineTop = currentElement.offsetTop;
      const lineHeight = currentElement.offsetHeight;
      
      // Center the current line
      const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
      
      containerRef.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    }
  });

  return (
    <div
      ref={containerRef}
      class={cn(
        'lyrics-display overflow-y-auto overflow-x-hidden scroll-smooth',
        'h-full py-8',
        props.class
      )}
    >
      <div class="space-y-4">
        <For each={props.lyrics}>
          {(line, index) => {
            const lineScore = () => getLineScore(index());
            const scoreStyle = () => getScoreStyle(lineScore());
            const isClickable = () => !props.isPlaying && props.onLyricClick;
            
            return (
              <div
                data-line-index={index()}
                class={cn(
                  interactiveListItemStyles({
                    isActive: index() === currentLineIndex(),
                    isClickable: isClickable(),
                    variant: 'compact'
                  }),
                  'text-left',
                  'text-xl leading-relaxed'
                )}
                style={{
                  color: scoreStyle().color || (index() === currentLineIndex() ? '#ffffff' : '#a8a8a8'),
                  opacity: index() === currentLineIndex() ? 1 : 0.8
                }}
                onClick={() => !props.isPlaying && props.onLyricClick?.(line, index())}
              >
                {line.text}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};