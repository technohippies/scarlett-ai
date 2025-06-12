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
    <Show when={props.title}>
      <header class={cn('flex items-center justify-center h-14 px-4 bg-transparent', props.class)}>
        <h1 class="text-lg font-semibold text-primary">
          {props.title}
        </h1>
      </header>
    </Show>
  );
};