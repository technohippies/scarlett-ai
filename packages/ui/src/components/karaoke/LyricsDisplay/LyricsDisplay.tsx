import { For, createEffect, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

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
  class?: string;
}

export const LyricsDisplay: Component<LyricsDisplayProps> = (props) => {
  const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;
  
  // Helper to get score for a line
  const getLineScore = (lineIndex: number) => {
    return props.lineScores?.find(s => s.lineIndex === lineIndex)?.score || null;
  };
  
  // Helper to get style and emoji based on score
  const getScoreStyle = (score: number | null) => {
    if (score === null) return {};
    
    // Friendly, gradual spectrum of warm colors
    if (score >= 90) {
      return { color: '#ff6b6b', textShadow: '0 0 20px rgba(255, 107, 107, 0.6)' }; // Bright warm red/orange with glow
    } else if (score >= 80) {
      return { color: '#ff8787' }; // Medium red
    } else if (score >= 70) {
      return { color: '#ffa8a8' }; // Light red
    } else if (score >= 60) {
      return { color: '#ffcece' }; // Very light red
    } else {
      return { color: '#ffe0e0' }; // Pale red
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
    
    // Find the line that contains the current time
    let foundIndex = -1;
    for (let i = 0; i < props.lyrics.length; i++) {
      const line = props.lyrics[i];
      if (!line) continue;
      const endTime = line.startTime + line.duration / 1000; // Convert duration from ms to seconds
      
      if (time >= line.startTime && time < endTime) {
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
      console.log('[LyricsDisplay] Current line changed:', {
        from: prevIndex,
        to: foundIndex,
        time: props.currentTime,
        timeInSeconds: time,
        jump: Math.abs(foundIndex - prevIndex)
      });
      
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

    // Add a small delay to ensure DOM is updated
    requestAnimationFrame(() => {
      const lineElements = containerRef.querySelectorAll('[data-line-index]');
      const currentElement = lineElements[index] as HTMLElement;

      if (currentElement) {
        const containerHeight = containerRef.clientHeight;
        const lineTop = currentElement.offsetTop;
        const lineHeight = currentElement.offsetHeight;
        const currentScrollTop = containerRef.scrollTop;

        // Calculate where the line should be positioned (slightly above center for better visibility)
        const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2 - 50;
        
        // Only scroll if the line is not already well-positioned
        const isLineVisible = lineTop >= currentScrollTop && 
                             lineTop + lineHeight <= currentScrollTop + containerHeight;
        
        const isLineCentered = Math.abs(currentScrollTop - targetScrollTop) < 100;
        
        if (!isLineVisible || !isLineCentered) {
          console.log('[LyricsDisplay] Scrolling to line:', index, 'targetScrollTop:', targetScrollTop);
          containerRef.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }
      }
    });
  });

  return (
    <div
      ref={containerRef}
      class={cn(
        'lyrics-display overflow-y-auto scroll-smooth',
        'h-full px-6 py-12',
        props.class
      )}
    >
      <div class="space-y-8">
        <For each={props.lyrics}>
          {(line, index) => {
            const lineScore = () => getLineScore(index());
            const scoreStyle = () => getScoreStyle(lineScore());
            // Using color gradients instead of emojis
            
            return (
              <div
                data-line-index={index()}
                class={cn(
                  'text-center transition-all duration-300',
                  'text-2xl leading-relaxed',
                  index() === currentLineIndex()
                    ? 'font-semibold scale-110'
                    : 'opacity-60'
                )}
                style={{
                  color: index() === currentLineIndex() && !lineScore() 
                    ? '#ffffff' // White for current line without score
                    : scoreStyle().color,
                  ...(index() === currentLineIndex() && lineScore() ? scoreStyle() : {})
                }}
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