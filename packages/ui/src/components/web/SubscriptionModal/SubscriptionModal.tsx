import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Modal } from '../../common/Modal';
import { SubscriptionPlan } from '../SubscriptionPlan';
import { Button } from '../../common/Button';
import IconXFill from 'phosphor-icons-solid/IconXFill';

export interface SubscriptionModalProps {
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

export const SubscriptionModal: Component<SubscriptionModalProps> = (props) => {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="relative bg-elevated rounded-xl p-6 max-w-md w-full mx-4">
        <button
          onClick={props.onClose}
          class="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface transition-colors"
          aria-label="Close"
        >
          <IconXFill class="w-5 h-5 text-secondary" />
        </button>
        
        <div class="space-y-6">
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
    </Modal>
  );
};