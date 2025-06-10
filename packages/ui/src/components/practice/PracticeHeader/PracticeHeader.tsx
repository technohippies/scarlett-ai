import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import IconXRegular from 'phosphor-icons-solid/IconXRegular';
import { cn } from '../../../utils/cn';

export interface PracticeHeaderProps {
  title?: string;
  onExit: () => void;
  class?: string;
}

export const PracticeHeader: Component<PracticeHeaderProps> = (props) => {
  return (
    <header class={cn('flex items-center justify-between h-14 px-4 bg-transparent', props.class)}>
      <button
        onClick={props.onExit}
        class="p-2 -ml-2 rounded-full hover:bg-highlight transition-colors"
        aria-label="Exit practice"
      >
        <IconXRegular size={24} class="text-secondary" />
      </button>
      
      <Show when={props.title}>
        <h1 class="text-lg font-semibold text-primary absolute left-1/2 transform -translate-x-1/2">
          {props.title}
        </h1>
      </Show>
      
      {/* Spacer to balance the layout */}
      <div class="w-10" />
    </header>
  );
};