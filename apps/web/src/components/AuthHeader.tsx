import type { Component } from 'solid-js';
import { Show, createEffect, createSignal } from 'solid-js';
import { AuthButton } from '@scarlett/ui';
import { address, isConnected, connectWallet, disconnectWallet } from '../services/wallet';
import IconFireFill from 'phosphor-icons-solid/IconFireFill';
import IconCrownFill from 'phosphor-icons-solid/IconCrownFill';

interface AuthHeaderProps {
  farcasterUser?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  onAuthSuccess?: (walletAddress: string) => void;
  currentStreak?: number;
  hasTopPosition?: boolean;
}

export const AuthHeader: Component<AuthHeaderProps> = (props) => {
  const [user, setUser] = createSignal<any>(null);

  // Create user object from wallet or Farcaster data
  createEffect(() => {
    if (isConnected() && address()) {
      setUser({
        address: address(),
        username: props.farcasterUser?.username,
        avatarUrl: props.farcasterUser?.pfpUrl
      });
    } else if (props.farcasterUser) {
      setUser({
        username: props.farcasterUser.username,
        avatarUrl: props.farcasterUser.pfpUrl
      });
    } else {
      setUser(null);
    }
  });

  // Handle authentication success
  createEffect(() => {
    const walletAddress = address();
    if (walletAddress && props.onAuthSuccess) {
      props.onAuthSuccess(walletAddress);
    }
  });

  return (
    <header class="bg-surface border-b border-subtle p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Show when={props.currentStreak !== undefined}>
            <div class="flex items-center gap-2">
              <IconFireFill class="w-8 h-8 text-orange-500" style="color: #ff6b35;" />
              <span class="text-2xl font-bold">
                {props.currentStreak}
              </span>
            </div>
          </Show>
          <div class="flex items-center gap-2">
            <IconCrownFill class="w-8 h-8 text-yellow-500" style="color: #fbbf24;" />
            <span class="text-xl font-bold" style="color: #fbbf24;">
              {props.hasTopPosition ? '1' : '0'}
            </span>
          </div>
          <Show when={props.farcasterUser}>
            <span class="text-sm text-secondary">
              via Farcaster
            </span>
          </Show>
        </div>
        
        <AuthButton
          user={user()}
          onSignInClick={connectWallet}
          onSignOutClick={disconnectWallet}
          variant="secondary"
          size="md"
        />
      </div>
    </header>
  );
};