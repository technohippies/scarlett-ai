import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { Button } from '../../common/Button';

export interface CreditPackProps {
  credits: number;
  price: string;
  currency?: 'USDC' | 'ETH' | 'SOL';
  discount?: number;
  recommended?: boolean;
  onPurchase?: () => void;
  disabled?: boolean;
  class?: string;
}

export const CreditPack: Component<CreditPackProps> = (props) => {
  return (
    <div
      class={cn(
        'relative rounded-lg border bg-surface p-4 transition-all',
        props.recommended ? 'border-accent-primary shadow-glow' : 'border-subtle hover:border-accent-primary/50',
        props.disabled && 'opacity-50',
        props.class
      )}
    >
      {props.recommended && (
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent-primary text-white text-xs font-semibold rounded-full">
          BEST VALUE
        </div>
      )}
      
      {props.discount && props.discount > 0 && (
        <div class="absolute -top-2 -right-2 px-2 py-1 bg-success text-white text-xs font-semibold rounded-md transform rotate-12">
          {props.discount}% OFF
        </div>
      )}
      
      <div class="text-center space-y-2 mb-4">
        <div class="text-3xl font-bold text-primary">{props.credits}</div>
        <div class="text-sm text-secondary">credits</div>
      </div>
      
      <div class="text-center mb-4">
        <div class="text-2xl font-semibold">
          {props.price} <span class="text-sm text-secondary">{props.currency || 'USDC'}</span>
        </div>
        {props.discount && props.discount > 0 && (
          <div class="text-sm text-tertiary line-through mt-1">
            {(parseFloat(props.price) / (1 - props.discount / 100)).toFixed(2)} {props.currency || 'USDC'}
          </div>
        )}
      </div>
      
      <Button
        variant={props.recommended ? 'primary' : 'secondary'}
        fullWidth
        onClick={props.onPurchase}
        disabled={props.disabled}
      >
        Purchase
      </Button>
    </div>
  );
};