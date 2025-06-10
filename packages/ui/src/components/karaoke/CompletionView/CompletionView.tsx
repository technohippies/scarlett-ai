import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { ShimmerText } from '../../common/ShimmerText';
import type { PlaybackSpeed } from '../../common/SplitButton';

export interface CompletionViewProps {
  score: number;
  rank: number;
  speed: PlaybackSpeed;
  feedbackText: string;
  class?: string;
}

export const CompletionView: Component<CompletionViewProps> = (props) => {
  return (
    <div class={cn('flex flex-col items-center justify-center min-h-screen p-6 bg-base', props.class)}>
      {/* Score */}
      <div class="text-6xl font-mono font-bold text-accent-primary mb-2">
        {props.score}
      </div>
      <div class="text-sm text-secondary mb-8">points</div>
      
      {/* Stats row */}
      <div class="flex gap-8 mb-12">
        {/* Rank */}
        <div class="text-center">
          <div class="text-2xl font-bold text-primary">#{props.rank}</div>
          <div class="text-sm text-secondary">Global Rank</div>
        </div>
        
        {/* Speed */}
        <div class="text-center">
          <div class="text-2xl font-bold text-primary">{props.speed}</div>
          <div class="text-sm text-secondary">Speed</div>
        </div>
      </div>
      
      {/* Feedback text with shimmer */}
      <div class="max-w-md text-center">
        <p class="text-lg text-primary leading-relaxed">
          <ShimmerText 
            text={props.feedbackText} 
            speed={60}
            unit="word"
          />
        </p>
      </div>
    </div>
  );
};