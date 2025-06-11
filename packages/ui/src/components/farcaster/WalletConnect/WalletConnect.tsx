import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import { cn } from '../../../utils/cn';
import { Button } from '../../common/Button';

export interface WalletConnectProps {
  address?: string;
  chain?: 'Base' | 'Solana';
  isConnected?: boolean;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  class?: string;
}

export const WalletConnect: Component<WalletConnectProps> = (props) => {
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div class={cn('p-4 bg-surface rounded-lg border border-subtle', props.class)}>
      <Show
        when={props.isConnected && props.address}
        fallback={
          <div class="text-center">
            <div class="mb-4 w-12 h-12 mx-auto rounded-full bg-accent-primary/10 flex items-center justify-center">
              <span class="text-2xl">💰</span>
            </div>
            <h3 class="text-lg font-semibold mb-2">Connect Wallet</h3>
            <p class="text-sm text-secondary mb-4">
              Connect your wallet to purchase credits
            </p>
            <Button
              variant="primary"
              onClick={props.onConnect}
              loading={props.isConnecting}
            >
              {props.isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </div>
        }
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Connected to {props.chain || 'Base'}</div>
            <div class="font-mono font-semibold">{formatAddress(props.address!)}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </Show>
    </div>
  );
};