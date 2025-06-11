import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface KaraokeHeaderProps {
  songTitle: string;
  artist: string;
  onBack?: () => void;
  isPlaying?: boolean;
  class?: string;
}

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const KaraokeHeader: Component<KaraokeHeaderProps> = (props) => {
  return (
    <div class={cn('relative flex items-center justify-center p-4', props.class)}>
      {/* Back/Pause button - absolute positioned */}
      <button
        onClick={props.onBack}
        class="absolute left-4 p-2 -m-2 text-secondary hover:text-primary transition-colors"
        aria-label={props.isPlaying ? "Pause" : "Go back"}
      >
        {props.isPlaying ? <PauseIcon /> : <ChevronLeft />}
      </button>
      
      {/* Song info - centered */}
      <h1 class="text-base font-medium text-primary text-center px-12 truncate max-w-full">
        {props.songTitle} - {props.artist}
      </h1>
    </div>
  );
};