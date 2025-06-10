import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  isCurrentUser?: boolean;
}

export interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  class?: string;
}

export const LeaderboardPanel: Component<LeaderboardPanelProps> = (props) => {
  return (
    <div class={cn('flex flex-col gap-2 p-4', props.class)}>
      <For each={props.entries}>
        {(entry) => (
          <div 
            class={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              entry.isCurrentUser 
                ? 'bg-accent-primary/10 border border-accent-primary/20' 
                : 'bg-surface hover:bg-surface-hover'
            )}
          >
            <span 
              class={cn(
                'w-8 text-center font-mono font-bold',
                entry.rank <= 3 ? 'text-accent-primary' : 'text-secondary'
              )}
            >
              #{entry.rank}
            </span>
            <span class={cn(
              'flex-1 truncate',
              entry.isCurrentUser ? 'text-accent-primary font-medium' : 'text-primary'
            )}>
              {entry.username}
            </span>
            <span class={cn(
              'font-mono font-bold',
              entry.isCurrentUser ? 'text-accent-primary' : 'text-primary'
            )}>
              {entry.score.toLocaleString()}
            </span>
          </div>
        )}
      </For>
    </div>
  );
};