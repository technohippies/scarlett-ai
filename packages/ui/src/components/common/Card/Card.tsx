import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { cn } from '../../../utils/cn'

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export const Card = (props: CardProps) => {
  const [local, others] = splitProps(props, [
    'variant',
    'padding',
    'class',
    'children',
  ])

  const variant = () => local.variant || 'default'
  const padding = () => local.padding || 'md'

  return (
    <div
      class={cn(
        'rounded-xl transition-all',
        {
          // Variants
          'bg-surface border border-subtle': variant() === 'default',
          'bg-transparent border-2 border-default': variant() === 'outlined',
          'bg-elevated shadow-xl hover:shadow-2xl hover:translate-y-[-2px]': variant() === 'elevated',
          // Padding
          'p-0': padding() === 'none',
          'p-3': padding() === 'sm',
          'p-6': padding() === 'md',
          'p-8': padding() === 'lg',
        },
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  )
}

export interface CardHeaderProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = (props: CardHeaderProps) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <div
      class={cn('mb-4', local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

export interface CardTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = (props: CardTitleProps) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <h3
      class={cn('text-xl font-semibold text-primary', local.class)}
      {...others}
    >
      {local.children}
    </h3>
  )
}

export interface CardDescriptionProps extends JSX.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = (props: CardDescriptionProps) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <p
      class={cn('text-sm text-secondary mt-1', local.class)}
      {...others}
    >
      {local.children}
    </p>
  )
}

export interface CardContentProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const CardContent = (props: CardContentProps) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <div
      class={cn('', local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

export interface CardFooterProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = (props: CardFooterProps) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <div
      class={cn('mt-6 flex items-center justify-between', local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}