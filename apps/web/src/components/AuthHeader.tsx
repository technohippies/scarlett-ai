import type { Component } from 'solid-js';
import { Show, createEffect, createSignal } from 'solid-js';
import { AuthButton, SearchInput } from '@scarlett/ui';
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
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

export const AuthHeader: Component<AuthHeaderProps> = (props) => {
  const [user, setUser] = createSignal<any>(null);
  const [isSearchExpanded, setIsSearchExpanded] = createSignal(false);
  const [searchValue, setSearchValue] = createSignal(props.searchQuery || '');

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

  // Update search value when props change
  createEffect(() => {
    setSearchValue(props.searchQuery || '');
    if (props.searchQuery) {
      setIsSearchExpanded(true);
    }
  });

  return (
    <header class="bg-surface border-b border-subtle p-4">
      <div class="flex items-center justify-between gap-4">
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
        
        {/* Search Bar with Animation */}
        <div 
          style={{
            flex: isSearchExpanded() ? '1' : '0',
            'max-width': isSearchExpanded() ? '500px' : '200px',
            transition: 'all 0.3s ease-out',
            'margin-right': '16px'
          }}
        >
          <SearchInput
            value={searchValue()}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setSearchValue(value);
              props.onSearch?.(value);
            }}
            onClear={() => {
              setSearchValue('');
              props.onSearch?.('');
              setIsSearchExpanded(false);
            }}
            onFocus={() => setIsSearchExpanded(true)}
            onBlur={(e) => {
              // Keep expanded if there's a value
              if (!searchValue() && !e.relatedTarget?.closest('.search-input')) {
                setIsSearchExpanded(false);
              }
            }}
            placeholder="Search..."
            style={{
              width: '100%',
              opacity: isSearchExpanded() ? 1 : 0.8,
              transform: isSearchExpanded() ? 'scale(1)' : 'scale(0.95)',
              transition: 'all 0.3s ease-out'
            }}
          />
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