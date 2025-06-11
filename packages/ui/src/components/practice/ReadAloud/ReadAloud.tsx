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
    <div class={cn('space-y-4', props.class)}>
      <p class="text-2xl text-left leading-relaxed">
        {props.prompt}
      </p>
      
      <Show when={props.userTranscript}>
        <div class="mt-6 pt-6 border-t border-border">
          <p class="text-sm text-muted-foreground mb-2">You said:</p>
          <p class="text-lg text-foreground">
            {props.userTranscript}
          </p>
        </div>
      </Show>
    </div>
  );
};