import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface UserProfileProps {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  credits?: number;
  compact?: boolean;
  class?: string;
}

export const UserProfile: Component<UserProfileProps> = (props) => {
  return (
    <div class={cn(
      'flex items-center gap-3',
      props.compact ? 'p-2' : 'p-4',
      props.class
    )}>
      <Show
        when={props.pfpUrl}
        fallback={
          <div class={cn(
            'rounded-full bg-accent-primary/10 flex items-center justify-center',
            props.compact ? 'w-8 h-8' : 'w-12 h-12'
          )}>
            <span class="text-accent-primary font-semibold">
              {props.username?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        }
      >
        <img 
          src={props.pfpUrl} 
          alt={props.displayName || props.username || 'User'} 
          class={cn(
            'rounded-full object-cover',
            props.compact ? 'w-8 h-8' : 'w-12 h-12'
          )}
        />
      </Show>
      
      <div class="flex-1 min-w-0">
        <div class={cn(
          'font-semibold truncate',
          props.compact ? 'text-sm' : 'text-base'
        )}>
          {props.displayName || props.username || 'Anonymous'}
        </div>
        <Show when={props.username && props.displayName}>
          <div class="text-sm text-secondary truncate">@{props.username}</div>
        </Show>
      </div>
      
      <Show when={props.credits !== undefined}>
        <div class="text-right">
          <div class="text-xs text-secondary">Credits</div>
          <div class={cn(
            'font-bold text-accent-primary',
            props.compact ? 'text-sm' : 'text-base'
          )}>
            {props.credits}
          </div>
        </div>
      </Show>
    </div>
  );
};