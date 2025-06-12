import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';
import { Button } from '../../common/Button';
import IconCheckCircleFill from 'phosphor-icons-solid/IconCheckCircleFill';

export interface SubscriptionPlanProps {
  isActive?: boolean;
  hasTrialAvailable?: boolean;
  onSubscribe?: () => void;
  onManage?: () => void;
  onConnectWallet?: () => void;
  disabled?: boolean;
  isConnected?: boolean;
  walletAddress?: string;
  class?: string;
}

export const SubscriptionPlan: Component<SubscriptionPlanProps> = (props) => {
  return (
    <div
      class={cn(
        'relative rounded-lg border bg-surface p-6 transition-all',
        props.isActive ? 'border-accent-primary shadow-glow' : 'border-subtle hover:border-accent-primary/50',
        props.disabled && 'opacity-50',
        props.class
      )}
    >
      <div class="text-center space-y-4">
        <div class="space-y-2">
          <div class="text-4xl font-bold">
            $10<span class="text-lg text-secondary">/mo</span>
          </div>
          
          <Show when={props.hasTrialAvailable && !props.isActive}>
            <p class="text-sm text-accent-primary font-medium">
              3-day free trial
            </p>
          </Show>
        </div>
        
        <ul class="space-y-3 text-left py-4">
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-sm text-primary">All songs on sc.maid.zone</span>
          </li>
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-sm text-primary">Unlimited song plays</span>
          </li>
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-sm text-primary">New features coming soon</span>
          </li>
        </ul>
        
        <Show
          when={props.isActive}
          fallback={
            <Show
              when={props.isConnected}
              fallback={
                <Button
                  variant="primary"
                  fullWidth
                  onClick={props.onConnectWallet}
                  disabled={props.disabled}
                >
                  Connect Wallet
                </Button>
              }
            >
              <div class="space-y-3">
                <Show when={props.walletAddress}>
                  <p class="text-xs text-secondary text-center truncate">
                    {props.walletAddress?.slice(0, 6)}...{props.walletAddress?.slice(-4)}
                  </p>
                </Show>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={props.onSubscribe}
                  disabled={props.disabled}
                >
                  {props.hasTrialAvailable ? 'Start Free Trial' : 'Subscribe with Unlock'}
                </Button>
              </div>
            </Show>
          }
        >
          <div class="space-y-3">
            <div class="flex items-center justify-center gap-2 text-sm text-accent-primary">
              <IconCheckCircleFill class="w-4 h-4" />
              <span class="font-medium">Active Subscription</span>
            </div>
            <Button
              variant="secondary"
              fullWidth
              onClick={props.onManage}
              disabled={props.disabled}
            >
              Manage Subscription
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
};