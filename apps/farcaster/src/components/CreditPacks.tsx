import type { Component } from 'solid-js';
import { For } from 'solid-js';

interface CreditPacksProps {
  onPurchase: (amount: number) => void;
}

const packs = [
  { credits: 10, price: '$0.99', label: '10 Credits' },
  { credits: 50, price: '$3.99', label: '50 Credits', recommended: true },
  { credits: 100, price: '$6.99', label: '100 Credits' },
];

export const CreditPacks: Component<CreditPacksProps> = (props) => {
  return (
    <div class="space-y-3">
      <h2 class="text-lg font-semibold">Purchase Credits</h2>
      <div class="grid gap-3">
        <For each={packs}>
          {(pack) => (
            <button
              class="p-4 bg-surface rounded-lg border border-subtle hover:border-accent-primary transition-colors relative"
              classList={{ 'border-accent-primary': pack.recommended }}
              onClick={() => props.onPurchase(pack.credits)}
            >
              {pack.recommended && (
                <span class="absolute -top-2 right-4 px-2 py-0.5 bg-accent-primary text-xs rounded">
                  Best Value
                </span>
              )}
              <div class="flex justify-between items-center">
                <div class="text-left">
                  <div class="font-semibold">{pack.label}</div>
                  <div class="text-sm text-secondary">Sing {pack.credits} songs</div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-accent-primary">{pack.price}</div>
                </div>
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
};