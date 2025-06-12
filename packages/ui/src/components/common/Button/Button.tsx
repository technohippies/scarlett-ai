import { Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { cn } from '../../../utils/cn'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  leftIcon?: JSX.Element
  rightIcon?: JSX.Element
}

export const Button = (props: ButtonProps) => {
  const [local, others] = splitProps(props, [
    'variant',
    'size',
    'fullWidth',
    'loading',
    'leftIcon',
    'rightIcon',
    'children',
    'class',
    'disabled',
  ])

  const variant = () => local.variant || 'primary'
  const size = () => local.size || 'md'

  return (
    <button
      disabled={local.disabled || local.loading}
      class={cn(
        'inline-flex items-center justify-center font-medium transition-all cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-50',
        {
          // Variants
          'bg-gradient-primary text-white hover:shadow-lg hover:brightness-110 glow-primary':
            variant() === 'primary',
          'bg-surface text-primary border border-default hover:bg-elevated hover:border-strong':
            variant() === 'secondary',
          'text-secondary hover:text-primary hover:bg-surface':
            variant() === 'ghost',
          'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg':
            variant() === 'danger',
          // Sizes
          'h-8 px-3 text-sm rounded-md gap-1.5': size() === 'sm',
          'h-10 px-4 text-base rounded-lg gap-2': size() === 'md',
          'h-12 px-6 text-lg rounded-lg gap-2.5': size() === 'lg',
          // Full width
          'w-full': local.fullWidth,
          // Loading state
          'cursor-wait': local.loading,
        },
        local.class
      )}
      {...others}
    >
      <Show when={local.loading}>
        <svg
          class="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </Show>

      <Show when={local.leftIcon && !local.loading}>
        {local.leftIcon}
      </Show>

      <Show when={local.children}>
        <span>{local.children}</span>
      </Show>

      <Show when={local.rightIcon}>
        {local.rightIcon}
      </Show>
    </button>
  )
}