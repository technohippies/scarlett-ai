import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

export type PlaybackSpeed = '1x' | '.75x' | '.5x';

export interface SplitButtonProps {
  onStart?: () => void;
  disabled?: boolean;
  class?: string;
}

const speeds: PlaybackSpeed[] = ['1x', '.75x', '.5x'];

export const SplitButton: Component<SplitButtonProps> = (props) => {
  const { t } = useI18n();
  
  const handleStart = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.onStart?.();
  };

  return (
    <button
      onClick={handleStart}
      disabled={props.disabled}
      class={cn(
        'w-full inline-flex items-center justify-center relative overflow-hidden',
        'h-12 px-6 text-lg font-medium rounded-lg',
        'bg-gradient-primary text-white shadow-lg',
        'cursor-pointer border-none outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'hover:bg-white/10 active:bg-white/20',
        'transition-all duration-300',
        props.class
      )}
    >
      <span class="relative z-10">{t('karaoke.controls.start')}</span>
    </button>
  );
};