import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';
import { Button } from '../../common/Button';
import IconCheckCircleFill from 'phosphor-icons-solid/IconCheckCircleFill';
import { useI18n } from '../../../i18n';

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
  const { t } = useI18n();
  
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
            <span innerHTML={t('subscription.plan.price')} />
          </div>
          
          <Show when={props.hasTrialAvailable && !props.isActive}>
            <p class="text-base text-accent-primary font-medium">
              {t('subscription.plan.trial')}
            </p>
          </Show>
        </div>
        
        <ul class="space-y-3 text-left py-4">
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-base text-primary">{t('subscription.plan.features.allSongs')}</span>
          </li>
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-base text-primary">{t('subscription.plan.features.unlimited')}</span>
          </li>
          <li class="flex items-center gap-3">
            <IconCheckCircleFill class="w-5 h-5 text-accent-primary flex-shrink-0" />
            <span class="text-base text-primary">{t('subscription.plan.features.newFeatures')}</span>
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
                  size="lg"
                  fullWidth
                  onClick={props.onConnectWallet}
                  disabled={props.disabled}
                >
                  {t('subscription.plan.actions.connectWallet')}
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
                  size="lg"
                  fullWidth
                  onClick={props.onSubscribe}
                  disabled={props.disabled}
                >
                  {props.hasTrialAvailable ? t('subscription.plan.actions.startTrial') : t('subscription.plan.actions.subscribe')}
                </Button>
              </div>
            </Show>
          }
        >
          <div class="space-y-3">
            <div class="flex items-center justify-center gap-2 text-base text-accent-primary">
              <IconCheckCircleFill class="w-4 h-4" />
              <span class="font-medium">{t('subscription.plan.actions.active')}</span>
            </div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={props.onManage}
              disabled={props.disabled}
            >
              {t('subscription.plan.actions.manage')}
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
};