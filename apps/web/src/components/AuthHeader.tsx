import type { Component } from 'solid-js';
import { Show, createEffect, createSignal } from 'solid-js';
import { AuthButton, SearchInput, Button } from '@scarlett/ui';
import { address, isConnected, connectWallet, disconnectWallet } from '../services/wallet';
import IconFireFill from 'phosphor-icons-solid/IconFireFill';
import IconCrownFill from 'phosphor-icons-solid/IconCrownFill';
import IconWalletFill from 'phosphor-icons-solid/IconWalletFill';

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
        {/* Left side: Streak and Crown */}
        <div class="flex items-center gap-3" style={{ 'min-width': '120px' }}>
          <Show when={props.currentStreak !== undefined}>
            <div class="flex items-center gap-2">
              <IconFireFill class="w-6 h-6 text-orange-500" style="color: #ff6b35;" />
              <span class="text-xl font-bold">
                {props.currentStreak}
              </span>
            </div>
          </Show>
          <div class="flex items-center gap-2">
            <IconCrownFill class="w-6 h-6 text-yellow-500" style="color: #fbbf24;" />
            <span class="text-lg font-bold" style="color: #fbbf24;">
              {props.hasTopPosition ? '1' : '0'}
            </span>
          </div>
        </div>
        
        {/* Center: Search Bar */}
        <div 
          style={{
            flex: '1',
            'margin': '0 16px'
          }}
        >
          <div
            style={{
              width: '100%',
              position: 'relative'
            }}
          >
            <input
              type="text"
              value={searchValue()}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setSearchValue(value);
                props.onSearch?.(value);
              }}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={(e) => {
                if (!searchValue()) {
                  setIsSearchExpanded(false);
                }
              }}
              placeholder="Search songs, artists..."
              style={{
                width: '100%',
                height: '40px',
                'padding-left': '40px',
                'padding-right': searchValue() ? '40px' : '16px',
                'border-radius': '8px',
                'background-color': 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
                'font-size': '16px',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              class="hover:border-strong focus:border-accent-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
            />
            <svg
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                color: 'var(--color-text-secondary)',
                'pointer-events': 'none'
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <Show when={searchValue()}>
              <button
                onClick={() => {
                  setSearchValue('');
                  props.onSearch?.('');
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  transition: 'color 0.2s'
                }}
                class="hover:text-primary"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
                  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"></path>
                </svg>
              </button>
            </Show>
          </div>
        </div>
        
        {/* Right side: Wallet Button */}
        <div style={{ 'min-width': '40px' }}>
          <Show 
            when={user()}
            fallback={
              <Button
                variant="secondary"
                size="md"
                onClick={connectWallet}
                style={{
                  width: '40px',
                  height: '40px',
                  padding: '0',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center'
                }}
              >
                <IconWalletFill class="w-5 h-5" />
              </Button>
            }
          >
            <AuthButton
              user={user()}
              onSignInClick={connectWallet}
              onSignOutClick={disconnectWallet}
              variant="secondary"
              size="md"
            />
          </Show>
        </div>
      </div>
    </header>
  );
};