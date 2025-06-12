import { Component, For, Show, createSignal } from 'solid-js';
import { Modal } from '../../common/Modal';
import { Motion } from 'solid-motionone';
import { BiLogosMeta } from 'solid-icons/bi';
import { SiWalletconnect } from 'solid-icons/si';
import { FaSolidWallet } from 'solid-icons/fa';
import { HiOutlineArrowLeft } from 'solid-icons/hi';

export interface WalletOption {
  id: string;
  name: string;
  icon: Component<{ class?: string }>;
  available: boolean;
}

export interface WalletSelectorProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  onConnect: (walletId: string) => void;
  wallets?: WalletOption[];
  connecting?: boolean;
  connectedWallet?: string;
  error?: string | null;
}

const defaultWallets: WalletOption[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: BiLogosMeta,
    available: true,
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: SiWalletconnect,
    available: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: (props: { class?: string }) => (
      <svg class={props.class} viewBox="0 0 32 32" fill="currentColor">
        <path d="M16 0C7.176 0 0 7.176 0 16s7.176 16 16 16 16-7.176 16-16S24.824 0 16 0zm0 28.8C8.954 28.8 3.2 23.046 3.2 16S8.954 3.2 16 3.2 28.8 8.954 28.8 16 23.046 28.8 16 28.8z"/>
        <path d="M13.6 11.2h4.8v9.6h-4.8z"/>
      </svg>
    ),
    available: true,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    icon: (props: { class?: string }) => (
      <svg class={props.class} viewBox="0 0 120 120" fill="none">
        <rect width="120" height="120" rx="24" fill="url(#rainbow-gradient)"/>
        <defs>
          <linearGradient id="rainbow-gradient" x1="0" y1="0" x2="120" y2="120">
            <stop offset="0%" stop-color="#FF5757"/>
            <stop offset="16.66%" stop-color="#FF914D"/>
            <stop offset="33.33%" stop-color="#FFDE59"/>
            <stop offset="50%" stop-color="#00D632"/>
            <stop offset="66.66%" stop-color="#0091FF"/>
            <stop offset="83.33%" stop-color="#6236FF"/>
            <stop offset="100%" stop-color="#BD34FE"/>
          </linearGradient>
        </defs>
      </svg>
    ),
    available: true,
  },
];

export const WalletSelector: Component<WalletSelectorProps> = (props) => {
  const wallets = () => props.wallets || defaultWallets;
  const [hoveredWallet, setHoveredWallet] = createSignal<string | null>(null);

  const handleWalletClick = (wallet: WalletOption) => {
    if (!wallet.available || props.connecting) return;
    props.onConnect(wallet.id);
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Connect Your Wallet"
      description="Choose your preferred wallet to continue"
      size="md"
    >
      <div class="space-y-4">
        <Show when={props.onBack}>
          <button
            onClick={props.onBack}
            class="flex items-center gap-2 text-sm text-content-secondary hover:text-content transition-colors"
          >
            <HiOutlineArrowLeft class="w-4 h-4" />
            Back to sign in options
          </button>
        </Show>

        <Show when={props.error}>
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            class="p-3 rounded-lg bg-danger/10 border border-danger/20"
          >
            <p class="text-sm text-danger">{props.error}</p>
          </Motion.div>
        </Show>

        <div class="space-y-2">
          <For each={wallets()}>
            {(wallet) => (
              <Motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: wallets().indexOf(wallet) * 0.05 }}
                onClick={() => handleWalletClick(wallet)}
                onMouseEnter={() => setHoveredWallet(wallet.id)}
                onMouseLeave={() => setHoveredWallet(null)}
                disabled={!wallet.available || props.connecting}
                class={`
                  w-full flex items-center justify-between p-4 rounded-lg
                  border transition-all duration-200
                  ${
                    props.connectedWallet === wallet.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : wallet.available
                      ? 'bg-surface-elevated hover:bg-surface-hover border-border-subtle hover:border-border'
                      : 'bg-surface opacity-50 border-border-subtle cursor-not-allowed'
                  }
                  ${
                    props.connecting && props.connectedWallet === wallet.id
                      ? 'animate-pulse'
                      : ''
                  }
                  ${
                    hoveredWallet() === wallet.id && wallet.available
                      ? 'transform scale-[1.02]'
                      : ''
                  }
                `}
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 flex items-center justify-center">
                    <wallet.icon class="w-6 h-6" />
                  </div>
                  <div class="text-left">
                    <p class="font-medium text-content">
                      {wallet.name}
                    </p>
                    <Show
                      when={props.connectedWallet === wallet.id}
                      fallback={
                        <p class="text-xs text-content-secondary">
                          {wallet.available ? 'Click to connect' : 'Not available'}
                        </p>
                      }
                    >
                      <p class="text-xs text-primary">
                        {props.connecting ? 'Connecting...' : 'Connected'}
                      </p>
                    </Show>
                  </div>
                </div>
                
                <Show when={props.connectedWallet === wallet.id && !props.connecting}>
                  <div class="w-2 h-2 rounded-full bg-success animate-pulse" />
                </Show>
              </Motion.button>
            )}
          </For>
        </div>

        <div class="pt-4 border-t border-border-subtle">
          <p class="text-xs text-content-secondary text-center">
            New to wallets?{' '}
            <a
              href="https://ethereum.org/wallets"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:text-primary-hover underline"
            >
              Learn more
            </a>
          </p>
        </div>
      </div>
    </Modal>
  );
};