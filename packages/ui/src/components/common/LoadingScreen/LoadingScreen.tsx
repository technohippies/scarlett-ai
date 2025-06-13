import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface LoadingScreenProps {
  message?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
  class?: string;
}

export const LoadingScreen: Component<LoadingScreenProps> = (props) => {
  const variant = () => props.variant || 'fullscreen';
  
  const content = () => (
    <div class="flex flex-col items-center justify-center space-y-4">
      <div class="relative">
        <div class="w-12 h-12 rounded-full border-4 border-surface"></div>
        <div class="absolute inset-0 w-12 h-12 rounded-full border-4 border-accent-primary border-t-transparent animate-spin"></div>
      </div>
      
      <Show when={props.message}>
        <p class="text-secondary text-sm animate-pulse">
          {props.message}
        </p>
      </Show>
    </div>
  );
  
  return (
    <Show
      when={variant() === 'fullscreen'}
      fallback={
        <Show
          when={variant() === 'overlay'}
          fallback={
            // Inline variant
            <div class={cn('flex items-center justify-center p-8', props.class)}>
              {content()}
            </div>
          }
        >
          {/* Overlay variant */}
          <div class={cn(
            'absolute inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50',
            props.class
          )}>
            {content()}
          </div>
        </Show>
      }
    >
      {/* Fullscreen variant */}
      <div class={cn('min-h-screen bg-base flex items-center justify-center', props.class)}>
        {content()}
      </div>
    </Show>
  );
};