import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { cn } from '../../../utils/cn';
import IconMagnifyingGlassBold from 'phosphor-icons-solid/IconMagnifyingGlassBold';
import IconXCircleFill from 'phosphor-icons-solid/IconXCircleFill';

export interface SearchInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  loading?: boolean;
}

export const SearchInput: Component<SearchInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    'class',
    'onClear',
    'loading',
    'value',
    'onInput'
  ]);

  return (
    <div class="relative">
      <IconMagnifyingGlassBold class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
      
      <input
        {...others}
        value={local.value || ''}
        onInput={local.onInput}
        class={cn(
          'w-full pl-10 pr-10 py-3 rounded-lg',
          'bg-surface border border-default',
          'text-text-primary placeholder:text-text-secondary',
          'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent',
          'transition-all duration-200',
          local.class
        )}
      />
      
      <Show when={local.value && local.onClear}>
        <button
          onClick={local.onClear}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
          type="button"
        >
          <IconXCircleFill class="w-5 h-5" />
        </button>
      </Show>
    </div>
  );
};