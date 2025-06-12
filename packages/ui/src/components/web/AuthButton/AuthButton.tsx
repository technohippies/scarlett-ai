import { Component, Show, createSignal } from 'solid-js';
import { Button } from '../../common/Button';
import { HiOutlineUser, HiOutlineChevronDown } from 'solid-icons/hi';
import { FiLogOut } from 'solid-icons/fi';
import { Motion, Presence } from 'solid-motionone';

export interface AuthButtonProps {
  user?: {
    username?: string;
    address?: string;
    avatarUrl?: string;
    credits?: number;
  };
  isLoading?: boolean;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export const AuthButton: Component<AuthButtonProps> = (props) => {
  const [showDropdown, setShowDropdown] = createSignal(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const displayName = () => {
    const user = props.user;
    if (!user) return '';
    
    if (user.username) {
      return `@${user.username}`;
    } else if (user.address) {
      return formatAddress(user.address);
    }
    return 'User';
  };

  return (
    <div class="relative">
      <Show
        when={props.user}
        fallback={
          <Button
            variant={props.variant || 'primary'}
            size={props.size || 'md'}
            onClick={props.onSignInClick}
            loading={props.isLoading}
            class={props.class}
          >
            <HiOutlineUser class="w-4 h-4 mr-2" />
            Sign In
          </Button>
        }
      >
        <button
          onClick={() => setShowDropdown(!showDropdown())}
          class={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            bg-surface-elevated border border-border-subtle
            hover:bg-surface-hover hover:border-border
            transition-all duration-200
            ${props.class || ''}
          `}
        >
          <Show
            when={props.user?.avatarUrl}
            fallback={
              <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                <HiOutlineUser class="w-4 h-4 text-content-secondary" />
              </div>
            }
          >
            <img
              src={props.user!.avatarUrl}
              alt={displayName()}
              class="w-8 h-8 rounded-full object-cover"
            />
          </Show>
          
          <span class="text-sm font-medium text-content">
            {displayName()}
          </span>
          
          <HiOutlineChevronDown
            class={`w-4 h-4 text-content-secondary transition-transform duration-200 ${
              showDropdown() ? 'rotate-180' : ''
            }`}
          />
        </button>

        <Presence>
          <Show when={showDropdown()}>
            <Motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              class="absolute right-0 mt-2 w-56 rounded-lg bg-surface-elevated border border-border-subtle shadow-lg overflow-hidden z-50"
            >
              <div class="p-2">
                <div class="px-3 py-2">
                  <p class="text-sm font-medium text-content">
                    {displayName()}
                  </p>
                  <Show when={props.user?.credits !== undefined}>
                    <p class="text-xs text-content-secondary mt-1">
                      💰 {props.user!.credits} credits
                    </p>
                  </Show>
                </div>
                
                <div class="h-px bg-border-subtle my-2" />
                
                <button
                  onClick={props.onSignOutClick}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-hover rounded-md transition-colors duration-200"
                >
                  <FiLogOut class="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </Motion.div>
          </Show>
        </Presence>
      </Show>
    </div>
  );
};