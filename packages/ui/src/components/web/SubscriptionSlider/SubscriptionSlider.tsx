import type { Component } from 'solid-js';
import { Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Transition } from 'solid-transition-group';
import { SubscriptionPlan } from '../SubscriptionPlan';
import { Button } from '../../common/Button';
import IconXFill from 'phosphor-icons-solid/IconXFill';

export interface SubscriptionSliderProps {
  isOpen: boolean;
  isActive?: boolean;
  hasTrialAvailable?: boolean;
  isProcessing?: boolean;
  isConnected?: boolean;
  walletAddress?: string;
  onClose: () => void;
  onSubscribe: () => void;
  onManage?: () => void;
  onConnectWallet?: () => void;
}

export const SubscriptionSlider: Component<SubscriptionSliderProps> = (props) => {
  // Lock body scroll when slider is open
  createEffect(() => {
    if (props.isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = originalOverflow;
      });
    }
  });

  // Handle escape key
  createEffect(() => {
    if (props.isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          props.onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      onCleanup(() => document.removeEventListener('keydown', handleEscape));
    }
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Portal>
      <Transition
        enterActiveClass="transition-opacity duration-300"
        enterClass="opacity-0"
        enterToClass="opacity-100"
        exitActiveClass="transition-opacity duration-300"
        exitClass="opacity-100"
        exitToClass="opacity-0"
      >
        <Show when={props.isOpen}>
          <div
            class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
        </Show>
      </Transition>

      <Transition
        enterActiveClass="transition-transform duration-300 ease-out"
        enterClass="translate-y-full"
        enterToClass="translate-y-0"
        exitActiveClass="transition-transform duration-300 ease-in"
        exitClass="translate-y-0"
        exitToClass="translate-y-full"
      >
        <Show when={props.isOpen}>
          <div class="fixed inset-x-0 bottom-0 z-50">
            <div class="bg-elevated rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden">
              {/* Handle bar */}
              <div class="flex justify-center pt-3 pb-2">
                <div class="w-12 h-1 bg-surface rounded-full" />
              </div>
              
              {/* Close button */}
              <div class="absolute top-4 right-4">
                <button
                  onClick={props.onClose}
                  class="p-2 rounded-lg bg-surface/50 hover:bg-surface transition-all hover:scale-110"
                  aria-label="Close"
                >
                  <IconXFill class="w-5 h-5 text-secondary hover:text-primary" />
                </button>
              </div>
              
              <div class="px-6 pb-8 space-y-6 overflow-y-auto max-h-[80vh]">
                <div class="text-center">
                  <h2 class="text-2xl font-bold text-primary mb-2">
                    {props.isActive ? 'Active' : 'Unlimited Karaoke'}
                  </h2>
                  <Show when={props.isActive}>
                    <p class="text-secondary text-sm">
                      Manage subscription
                    </p>
                  </Show>
                </div>
                
                <SubscriptionPlan
                  isActive={props.isActive}
                  hasTrialAvailable={props.hasTrialAvailable}
                  isConnected={props.isConnected}
                  walletAddress={props.walletAddress}
                  onSubscribe={props.onSubscribe}
                  onManage={props.onManage}
                  onConnectWallet={props.onConnectWallet}
                  disabled={props.isProcessing}
                />
                
              </div>
            </div>
          </div>
        </Show>
      </Transition>
    </Portal>
  );
};