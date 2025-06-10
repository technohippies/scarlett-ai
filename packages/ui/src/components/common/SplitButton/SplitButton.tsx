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
    const nextIndex = (currentSpeedIndex() + 1) % speeds.length;
    setCurrentSpeedIndex(nextIndex);
    const newSpeed = speeds[nextIndex];
    if (newSpeed) {
      props.onSpeedChange?.(newSpeed);
    }
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
        onClick={props.onStart}
        disabled={props.disabled}
        class={cn(
          'flex-1 inline-flex items-center justify-center relative overflow-hidden',
          'h-12 px-6 text-lg font-medium',
          'cursor-pointer border-none outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-white/10 active:bg-white/20'
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
          'w-20 text-lg font-medium',
          'cursor-pointer border-none outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-white/10 active:bg-white/20',
          'after:content-[""] after:absolute after:inset-0',
          'after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent',
          'after:translate-x-[-200%] hover:after:translate-x-[200%]',
          'after:transition-transform after:duration-700'
        )}
        aria-label="Change playback speed"
      >
        <span class="relative z-10">{currentSpeed()}</span>
      </button>
    </div>
  );
};