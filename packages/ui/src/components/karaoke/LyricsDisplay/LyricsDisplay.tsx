import { For, createEffect, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface LyricLine {
  id: string;
  text: string;
  startTime: number;
  duration: number;
}

export interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentTime?: number;
  isPlaying?: boolean;
  class?: string;
}

export const LyricsDisplay: Component<LyricsDisplayProps> = (props) => {
  const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;

  // Find current line based on time
  createEffect(() => {
    if (!props.currentTime) {
      setCurrentLineIndex(-1);
      return;
    }

    const time = props.currentTime;
    const index = props.lyrics.findIndex((line) => {
      const endTime = line.startTime + line.duration;
      return time >= line.startTime && time < endTime;
    });

    setCurrentLineIndex(index);
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
      const scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;

      containerRef.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      });
    }
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
          {(line, index) => (
            <div
              data-line-index={index()}
              class={cn(
                'text-center transition-all duration-300',
                'text-2xl leading-relaxed',
                index() === currentLineIndex()
                  ? 'text-primary font-semibold scale-110'
                  : 'text-secondary opacity-60'
              )}
            >
              {line.text}
            </div>
          )}
        </For>
      </div>
    </div>
  );
};