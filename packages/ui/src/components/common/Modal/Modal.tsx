import { Show, splitProps, createEffect, onCleanup } from 'solid-js'
import type { JSX, Component } from 'solid-js'
import { Portal } from 'solid-js/web'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'

export interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'danger' | 'success'
  hideCloseButton?: boolean
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  children?: JSX.Element
  footer?: JSX.Element
}

export const Modal: Component<ModalProps> = (props) => {
  const [local, others] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'description',
    'size',
    'variant',
    'hideCloseButton',
    'closeOnBackdropClick',
    'closeOnEscape',
    'children',
    'footer',
  ])

  const size = () => local.size || 'md'
  const variant = () => local.variant || 'default'
  const closeOnBackdropClick = () => local.closeOnBackdropClick ?? true
  const closeOnEscape = () => local.closeOnEscape ?? true

  // Handle escape key
  createEffect(() => {
    if (local.open && closeOnEscape()) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          local.onClose?.()
        }
      }
      document.addEventListener('keydown', handleEscape)
      onCleanup(() => document.removeEventListener('keydown', handleEscape))
    }
  })

  // Lock body scroll when modal is open
  createEffect(() => {
    if (local.open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      onCleanup(() => {
        document.body.style.overflow = originalOverflow
      })
    }
  })

  const handleBackdropClick = (e: MouseEvent) => {
    if (closeOnBackdropClick() && e.target === e.currentTarget) {
      local.onClose?.()
    }
  }

  return (
    <Show when={local.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          {...others}
        >
          {/* Backdrop */}
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" />
          
          {/* Modal */}
          <div
            class={cn(
              'relative bg-elevated rounded-xl shadow-2xl border border-subtle',
              'animate-in zoom-in-95 fade-in duration-200',
              'max-h-[90vh] overflow-hidden flex flex-col',
              {
                // Sizes
                'w-full max-w-sm': size() === 'sm',
                'w-full max-w-md': size() === 'md',
                'w-full max-w-lg': size() === 'lg',
                'w-full max-w-xl': size() === 'xl',
              }
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <Show when={local.title || !local.hideCloseButton}>
              <div class="flex items-start justify-between p-6 pb-0">
                <div class="flex-1">
                  <Show when={local.title}>
                    <h2
                      class={cn(
                        'text-xl font-semibold',
                        {
                          'text-primary': variant() === 'default',
                          'text-red-500': variant() === 'danger',
                          'text-green-500': variant() === 'success',
                        }
                      )}
                    >
                      {local.title}
                    </h2>
                  </Show>
                  <Show when={local.description}>
                    <p class="text-sm text-secondary mt-1">
                      {local.description}
                    </p>
                  </Show>
                </div>
                <Show when={!local.hideCloseButton}>
                  <button
                    onClick={local.onClose}
                    class="ml-4 p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface transition-colors"
                    aria-label="Close modal"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 5L5 15M5 5l10 10"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </Show>
              </div>
            </Show>

            {/* Content */}
            <div class="flex-1 overflow-y-auto p-6">
              {local.children}
            </div>

            {/* Footer */}
            <Show when={local.footer}>
              <div class="p-6 pt-0 mt-auto">
                {local.footer}
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

// Pre-built modal footer components
export interface ModalFooterProps {
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger' | 'secondary'
  confirmLoading?: boolean
  confirmDisabled?: boolean
}

export const ModalFooter: Component<ModalFooterProps> = (props) => {
  const confirmText = () => props.confirmText || 'Confirm'
  const cancelText = () => props.cancelText || 'Cancel'
  const confirmVariant = () => props.confirmVariant || 'primary'

  return (
    <div class="flex items-center justify-end gap-3">
      <Show when={props.onCancel}>
        <Button
          variant="ghost"
          onClick={props.onCancel}
        >
          {cancelText()}
        </Button>
      </Show>
      <Show when={props.onConfirm}>
        <Button
          variant={confirmVariant()}
          onClick={props.onConfirm}
          loading={props.confirmLoading}
          disabled={props.confirmDisabled}
        >
          {confirmText()}
        </Button>
      </Show>
    </div>
  )
}

// Utility function for common modal patterns
export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  confirmLoading?: boolean
}

export const ConfirmModal: Component<ConfirmModalProps> = (props) => {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
      variant={props.variant}
      size="sm"
      footer={
        <ModalFooter
          onConfirm={props.onConfirm}
          onCancel={props.onClose}
          confirmText={props.confirmText}
          cancelText={props.cancelText}
          confirmVariant={props.variant === 'danger' ? 'danger' : 'primary'}
          confirmLoading={props.confirmLoading}
        />
      }
    />
  )
}