import { Show, createSignal } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface HeaderProps {
  title?: string;
  logo?: JSX.Element;
  actions?: JSX.Element;
  variant?: 'default' | 'minimal' | 'transparent';
  sticky?: boolean;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  class?: string;
}

export const Header: Component<HeaderProps> = (props) => {
  const [isScrolled, setIsScrolled] = createSignal(false);

  // Track scroll position for sticky header effects
  if (typeof window !== 'undefined' && props.sticky) {
    window.addEventListener('scroll', () => {
      setIsScrolled(window.scrollY > 10);
    });
  }

  const variant = () => props.variant || 'default';

  return (
    <header
      class={cn(
        'w-full transition-all duration-200',
        {
          // Variants
          'bg-surface border-b border-subtle': variant() === 'default',
          'bg-transparent': variant() === 'minimal' || variant() === 'transparent',
          'backdrop-blur-md bg-surface/80': variant() === 'transparent' && isScrolled(),
          // Sticky behavior
          'sticky top-0 z-50': props.sticky,
          'shadow-lg': props.sticky && isScrolled(),
        },
        props.class
      )}
    >
      <div class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          {/* Left section */}
          <div class="flex items-center gap-4">
            <Show when={props.showMenuButton}>
              <button
                onClick={props.onMenuClick}
                class="p-2 rounded-lg hover:bg-highlight transition-colors lg:hidden"
                aria-label="Menu"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </Show>

            <Show when={props.logo} fallback={
              <Show when={props.title}>
                <h1 class="text-xl font-bold text-primary">{props.title}</h1>
              </Show>
            }>
              {props.logo}
            </Show>
          </div>

          {/* Right section */}
          <Show when={props.actions}>
            <div class="flex items-center gap-2">
              {props.actions}
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
};