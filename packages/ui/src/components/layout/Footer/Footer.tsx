import { Show, For } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  variant?: 'default' | 'minimal' | 'centered';
  sections?: FooterSection[];
  bottomContent?: JSX.Element;
  socialLinks?: JSX.Element;
  copyright?: string;
  class?: string;
}

export const Footer: Component<FooterProps> = (props) => {
  const variant = () => props.variant || 'default';
  const currentYear = new Date().getFullYear();

  return (
    <footer
      class={cn(
        'w-full bg-surface border-t border-subtle',
        props.class
      )}
    >
      <div class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <Show when={variant() === 'default' && props.sections}>
          <div class="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <For each={props.sections}>
              {(section) => (
                <div>
                  <h3 class="text-sm font-semibold text-primary mb-4">{section.title}</h3>
                  <ul class="space-y-2">
                    <For each={section.links}>
                      {(link) => (
                        <li>
                          <a
                            href={link.href}
                            target={link.external ? '_blank' : undefined}
                            rel={link.external ? 'noopener noreferrer' : undefined}
                            class="text-sm text-secondary hover:text-primary transition-colors"
                          >
                            {link.label}
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={variant() === 'minimal'}>
          <div class="py-6">
            <Show when={props.bottomContent}>
              {props.bottomContent}
            </Show>
          </div>
        </Show>

        <Show when={variant() === 'centered'}>
          <div class="py-8 text-center">
            <Show when={props.socialLinks}>
              <div class="mb-4 flex justify-center gap-4">
                {props.socialLinks}
              </div>
            </Show>
          </div>
        </Show>

        {/* Copyright section */}
        <Show when={props.copyright !== false}>
          <div class={cn(
            'py-4 text-center text-sm text-muted',
            variant() !== 'minimal' && 'border-t border-subtle'
          )}>
            {props.copyright || `© ${currentYear} Scarlett. All rights reserved.`}
          </div>
        </Show>
      </div>
    </footer>
  );
};