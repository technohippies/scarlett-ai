import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface DescribeProps {
  prompt: string;
  userTranscript?: string;
  isCorrect?: boolean;
  class?: string;
}

export const Describe: Component<DescribeProps> = (props) => {
  return (
    <div class={cn('space-y-6', props.class)}>
      <p class="text-xl md:text-2xl text-left">
        {props.prompt}
      </p>
      
      <Show when={props.userTranscript}>
        <div class={cn(
          'rounded-lg p-4 transition-colors',
          props.isCorrect === true && 'bg-green-500/20 border border-green-500/40',
          props.isCorrect === false && 'bg-red-500/20 border border-red-500/40',
          props.isCorrect === undefined && 'bg-highlight'
        )}>
          <p class="text-sm text-secondary mb-1">Your response:</p>
          <p class="text-lg font-medium text-primary">
            {props.userTranscript}
          </p>
        </div>
      </Show>
    </div>
  );
};