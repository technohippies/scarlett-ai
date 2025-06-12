import { Component, Show, createSignal } from 'solid-js';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { useAuth } from '@scarlett/auth';
import { SiFarcaster } from 'solid-icons/si';
import { HiOutlineLink } from 'solid-icons/hi';
import { BiLogosMeta } from 'solid-icons/bi';
import { FaSolidWallet } from 'solid-icons/fa';
import { Motion } from 'solid-motionone';

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onWalletConnect?: () => void;
  enableDemoMode?: boolean;
}

export const AuthModal: Component<AuthModalProps> = (props) => {
  const { signIn, isLoading } = useAuth();
  const [authMethod, setAuthMethod] = createSignal<'farcaster' | 'wallet' | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const handleFarcasterSignIn = async () => {
    setError(null);
    setAuthMethod('farcaster');
    
    try {
      // In a Farcaster mini app context, this would use the SDK
      // For now, we'll simulate the flow
      await signIn('farcaster', {});
      props.onClose();
    } catch (err) {
      setError('Failed to sign in with Farcaster. Please try again.');
      setAuthMethod(null);
    }
  };

  const handleWalletConnect = () => {
    setAuthMethod('wallet');
    if (props.onWalletConnect) {
      props.onWalletConnect();
    }
  };

  const handleDemoMode = async () => {
    setError(null);
    try {
      await signIn('demo', {});
      props.onClose();
    } catch (err) {
      setError('Failed to enter demo mode. Please try again.');
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Welcome to Scarlett"
      description="Choose how you'd like to sign in"
      size="md"
    >
      <div class="space-y-4">
        <Show when={error()}>
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            class="p-3 rounded-lg bg-danger/10 border border-danger/20"
          >
            <p class="text-sm text-danger">{error()}</p>
          </Motion.div>
        </Show>

        <div class="space-y-3">
          {/* Farcaster Sign In */}
          <button
            onClick={handleFarcasterSignIn}
            disabled={isLoading() && authMethod() === 'farcaster'}
            class={`
              w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
              bg-purple-600 hover:bg-purple-700 text-white
              transition-all duration-200 transform hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${authMethod() === 'farcaster' ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-background' : ''}
            `}
          >
            <SiFarcaster class="w-5 h-5" />
            <span class="font-medium">
              {isLoading() && authMethod() === 'farcaster' ? 'Signing in...' : 'Sign in with Farcaster'}
            </span>
          </button>

          {/* Wallet Connect */}
          <button
            onClick={handleWalletConnect}
            disabled={isLoading() && authMethod() === 'wallet'}
            class={`
              w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
              bg-surface-elevated hover:bg-surface-hover
              border border-border-subtle hover:border-border
              text-content transition-all duration-200 transform hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${authMethod() === 'wallet' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
            `}
          >
            <HiOutlineLink class="w-5 h-5" />
            <span class="font-medium">Connect Wallet</span>
          </button>

          <Show when={props.enableDemoMode}>
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-border-subtle" />
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="px-2 bg-background text-content-secondary">or</span>
              </div>
            </div>

            <button
              onClick={handleDemoMode}
              disabled={isLoading()}
              class={`
                w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                text-content-secondary hover:text-content
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span class="text-sm">Try Demo Mode</span>
            </button>
          </Show>
        </div>

        <div class="pt-4 border-t border-border-subtle">
          <p class="text-xs text-content-secondary text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </Modal>
  );
};