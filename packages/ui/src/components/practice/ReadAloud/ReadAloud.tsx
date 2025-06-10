import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ReadAloudProps {
  prompt: string;
  userTranscript?: string;
  class?: string;
}

export const ReadAloud: Component<ReadAloudProps> = (props) => {
  return (
    <div class={cn('space-y-6', props.class)}>
      <p class="text-xl md:text-2xl text-left">
        {props.prompt}
      </p>
      
      <Show when={props.userTranscript}>
        <div>
          <p class="text-md text-secondary mb-2">Your response:</p>
          <p class="text-lg text-primary">
            {props.userTranscript}
          </p>
        </div>
      </Show>
    </div>
  );
};