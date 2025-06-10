import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface AppShellProps {
  children: JSX.Element | (() => JSX.Element);
  maxWidth?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  showHeader?: boolean;
  showFooter?: boolean;
  headerContent?: JSX.Element | (() => JSX.Element);
  footerContent?: JSX.Element | (() => JSX.Element);
  class?: string;
}

export const AppShell: Component<AppShellProps> = (props) => {
  const [isScrolled, setIsScrolled] = createSignal(false);
  let mainRef: HTMLElement | undefined;

  const handleScroll = () => {
    if (mainRef) {
      setIsScrolled(mainRef.scrollTop > 10);
    }
  };

  onMount(() => {
    if (mainRef) {
      mainRef.addEventListener('scroll', handleScroll);
    }
  });

  onCleanup(() => {
    if (mainRef) {
      mainRef.removeEventListener('scroll', handleScroll);
    }
  });

  const paddingClass = () => {
    switch (props.padding) {
      case 'none':
        return 'p-0';
      case 'sm':
        return 'p-4';
      case 'lg':
        return 'p-8';
      case 'md':
      default:
        return 'p-6';
    }
  };

  return (
    <div class={cn('flex flex-col h-screen overflow-hidden', props.class)}>
      <Show when={props.showHeader}>
        <header
          class={cn(
            'flex-shrink-0 transition-all duration-200 z-10',
            isScrolled() && 'shadow-md backdrop-blur-sm'
          )}
        >
          {typeof props.headerContent === 'function' ? props.headerContent() : props.headerContent}
        </header>
      </Show>

      <main
        ref={mainRef}
        class={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          paddingClass()
        )}
      >
        <div
          class="mx-auto w-full"
          style={{ 'max-width': props.maxWidth || '100%' }}
        >
          {typeof props.children === 'function' ? props.children() : props.children}
        </div>
      </main>

      <Show when={props.showFooter}>
        <footer class="flex-shrink-0 border-t border-subtle">
          {typeof props.footerContent === 'function' ? props.footerContent() : props.footerContent}
        </footer>
      </Show>
    </div>
  );
};