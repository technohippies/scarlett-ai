import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export type PlaybackSpeed = '1x' | '0.75x' | '0.5x';

export interface SplitButtonProps {
  onStart?: () => void;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  disabled?: boolean;
  class?: string;
}

const speeds: PlaybackSpeed[] = ['1x', '0.75x', '0.5x'];

export const SplitButton: Component<SplitButtonProps> = (props) => {
  const [currentSpeedIndex, setCurrentSpeedIndex] = createSignal(0);
  
  const currentSpeed = () => speeds[currentSpeedIndex()];
  
  const cycleSpeed = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextIndex = (currentSpeedIndex() + 1) % speeds.length;
    setCurrentSpeedIndex(nextIndex);
    const newSpeed = speeds[nextIndex];
    if (newSpeed) {
      props.onSpeedChange?.(newSpeed);
    }
  };
  
  const handleStart = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.onStart?.();
  };

  return (
    <div 
      class={cn(
        'relative inline-flex w-full rounded-lg overflow-hidden',
        'bg-gradient-primary text-white shadow-lg',
        'transition-all duration-300',
        props.class
      )}
    >
      {/* Main button */}
      <button
        onClick={handleStart}
        disabled={props.disabled}
        class={cn(
          'flex-1 inline-flex items-center justify-center relative overflow-hidden',
          'h-12 px-6 text-lg font-medium',
          'cursor-pointer border-none outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-white/10 active:bg-white/20',
          'transition-colors'
        )}
      >
        <span class="relative z-10">Start</span>
      </button>
      
      {/* Divider */}
      <div class="w-px bg-black/20" />
      
      {/* Speed button */}
      <button
        onClick={cycleSpeed}
        disabled={props.disabled}
        class={cn(
          'inline-flex items-center justify-center relative',
          'w-16 text-base font-medium',
          'cursor-pointer border-none outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-white/10 active:bg-white/20',
          'transition-colors',
          'border-l border-l-black/20'
        )}
        aria-label="Change playback speed"
        title="Change playback speed"
      >
        <span class="relative z-10 flex items-center gap-1">
          <span>{currentSpeed()}</span>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-60">
            <path d="M2 3L4 5L6 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>
    </div>
  );
};