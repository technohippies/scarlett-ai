import type { Config } from 'tailwindcss'

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {},
  safelist: [
    // Preserve custom utility classes
    'bg-base',
    'bg-surface', 
    'bg-elevated',
    'bg-highlight',
    'text-primary',
    'text-secondary',
    'text-muted',
    'text-accent',
    'bg-accent',
    'bg-accent-hover',
    'border-subtle',
    'border-default',
    'border-strong',
    'bg-gradient-primary',
    'bg-gradient-surface',
    'glow-primary',
    'glow-secondary',
    'animate-shimmer-text',
    'animate-cursor-blink',
    'safe-area-inset',
    'safe-area-inset-top',
    'safe-area-inset-bottom',
    'touch-pan-y',
    'overscroll-contain',
    'scroll-smooth',
    'select-none',
    'ring-offset-base'
  ]
} satisfies Config