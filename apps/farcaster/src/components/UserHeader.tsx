import { Component, Show } from 'solid-js';

interface UserHeaderProps {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  credits: number;
}

export const UserHeader: Component<UserHeaderProps> = (props) => {
  return (
    <header class="bg-surface border-b border-subtle p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Show when={props.user?.pfpUrl}>
            <img 
              src={props.user!.pfpUrl} 
              alt={props.user?.displayName || props.user?.username || 'User'} 
              class="w-10 h-10 rounded-full"
            />
          </Show>
          <div>
            <div class="font-semibold">
              {props.user?.displayName || props.user?.username || 'Guest'}
            </div>
            <Show when={props.user?.username}>
              <div class="text-sm text-secondary">@{props.user!.username}</div>
            </Show>
          </div>
        </div>
        
        <div class="text-right">
          <div class="text-sm text-secondary">Credits</div>
          <div class="font-bold text-accent-primary">{props.credits}</div>
        </div>
      </div>
    </header>
  );
};