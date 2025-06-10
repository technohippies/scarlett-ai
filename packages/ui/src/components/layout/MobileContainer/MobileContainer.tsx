import { createSignal, onMount, Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface MobileContainerProps {
  children: JSX.Element | (() => JSX.Element);
  maxWidth?: '375px' | '390px' | '420px' | '424px';
  safeArea?: boolean;
  centerContent?: boolean;
  backgroundColor?: string;
  class?: string;
}

export const MobileContainer: Component<MobileContainerProps> = (props) => {
  const [_viewportHeight, setViewportHeight] = createSignal(0);

  onMount(() => {
    // Handle viewport height changes (e.g., mobile browser chrome)
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
      // Set CSS custom property for true viewport height
      document.documentElement.style.setProperty(
        '--vh',
        `${window.innerHeight * 0.01}px`
      );
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  });

  return (
    <div
      class={cn(
        'mobile-container relative w-full mx-auto',
        // Touch optimizations
        'touch-pan-y overscroll-contain',
        // Safe area handling
        props.safeArea && 'safe-area-inset',
        // Centering
        props.centerContent && 'flex flex-col',
        props.class
      )}
      style={{
        'max-width': props.maxWidth || '420px',
        'background-color': props.backgroundColor,
        // Use CSS custom property for viewport height
        'min-height': 'calc(var(--vh, 1vh) * 100)',
      }}
    >
      <div
        class={cn(
          'mobile-content w-full',
          // Prevent text selection on mobile
          'select-none sm:select-auto',
          // Smooth scrolling
          'scroll-smooth',
          // Centering content
          props.centerContent && 'flex-1 flex items-center justify-center'
        )}
      >
        {typeof props.children === 'function' ? props.children() : props.children}
      </div>

      {/* iOS home indicator spacing */}
      <Show when={props.safeArea}>
        <div class="h-[env(safe-area-inset-bottom)] w-full" />
      </Show>
    </div>
  );
};