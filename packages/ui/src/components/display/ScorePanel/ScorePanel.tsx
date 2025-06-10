import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ScorePanelProps {
  score: number;
  rank: number;
  class?: string;
}

export const ScorePanel: Component<ScorePanelProps> = (props) => {
  return (
    <div class={cn('grid grid-cols-[1fr_1fr] gap-2 p-4', props.class)}>
      {/* Score Box */}
      <div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
        <div class="text-2xl font-mono font-bold text-accent-primary">
          {props.score}
        </div>
        <div class="text-sm text-secondary mt-1">
          Score
        </div>
      </div>
      
      {/* Rank Box */}
      <div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
        <div class="text-2xl font-mono font-bold text-accent-secondary">
          {props.rank}
        </div>
        <div class="text-sm text-secondary mt-1">
          Rank
        </div>
      </div>
    </div>
  );
};