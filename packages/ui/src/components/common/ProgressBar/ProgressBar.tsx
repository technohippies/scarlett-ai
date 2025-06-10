import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ProgressBarProps {
  current: number;
  total: number;
  class?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const percentage = () => Math.min(100, Math.max(0, (props.current / props.total) * 100));
  
  return (
    <div class={cn('w-full h-1.5 bg-highlight', props.class)}>
      <div
        class="h-full bg-accent transition-all duration-300 ease-out rounded-r-sm"
        style={{ width: `${percentage()}%` }}
      />
    </div>
  );
};