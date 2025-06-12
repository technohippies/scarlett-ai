import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { Modal, ModalFooter, ConfirmModal } from './Modal'
import { Button } from '../Button'

const meta = {
  title: 'Common/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

// Default Modal
export const Default: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Welcome to Scarlett"
          description="This is a simple modal dialog with some example content."
        >
          <p class="text-secondary">
            This is the modal body. You can put any content here, including forms,
            images, or other components. The modal will automatically handle scrolling
            if the content is too long.
          </p>
        </Modal>
      </>
    )
  },
}

// Modal with Footer
export const WithFooter: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    const [loading, setLoading] = createSignal(false)
    
    const handleConfirm = () => {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setOpen(false)
      }, 2000)
    }
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal with Footer</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Save Changes?"
          description="You have unsaved changes. Do you want to save them?"
          footer={
            <ModalFooter
              onConfirm={handleConfirm}
              onCancel={() => setOpen(false)}
              confirmText="Save"
              cancelText="Discard"
              confirmLoading={loading()}
            />
          }
        >
          <div class="space-y-4">
            <div class="p-4 bg-surface rounded-lg border border-subtle">
              <p class="text-sm text-secondary">Modified files:</p>
              <ul class="mt-2 space-y-1">
                <li class="text-sm text-primary">• components/Modal.tsx</li>
                <li class="text-sm text-primary">• styles/globals.css</li>
              </ul>
            </div>
          </div>
        </Modal>
      </>
    )
  },
}

// Different Sizes
export const Sizes: Story = {
  render: () => {
    const [smallOpen, setSmallOpen] = createSignal(false)
    const [mediumOpen, setMediumOpen] = createSignal(false)
    const [largeOpen, setLargeOpen] = createSignal(false)
    const [xlOpen, setXlOpen] = createSignal(false)
    
    return (
      <div class="flex gap-4">
        <Button onClick={() => setSmallOpen(true)}>Small Modal</Button>
        <Button onClick={() => setMediumOpen(true)}>Medium Modal</Button>
        <Button onClick={() => setLargeOpen(true)}>Large Modal</Button>
        <Button onClick={() => setXlOpen(true)}>XL Modal</Button>
        
        <Modal
          open={smallOpen()}
          onClose={() => setSmallOpen(false)}
          title="Small Modal"
          size="sm"
        >
          <p class="text-secondary">This is a small modal, perfect for quick confirmations.</p>
        </Modal>
        
        <Modal
          open={mediumOpen()}
          onClose={() => setMediumOpen(false)}
          title="Medium Modal"
          size="md"
        >
          <p class="text-secondary">This is a medium modal, the default size for most use cases.</p>
        </Modal>
        
        <Modal
          open={largeOpen()}
          onClose={() => setLargeOpen(false)}
          title="Large Modal"
          size="lg"
        >
          <p class="text-secondary">This is a large modal, suitable for forms or detailed content.</p>
        </Modal>
        
        <Modal
          open={xlOpen()}
          onClose={() => setXlOpen(false)}
          title="Extra Large Modal"
          size="xl"
        >
          <p class="text-secondary">This is an extra large modal, great for complex interfaces or data tables.</p>
        </Modal>
      </div>
    )
  },
}

// Danger Variant
export const DangerVariant: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete Account</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Delete Account"
          description="This action cannot be undone."
          variant="danger"
          footer={
            <ModalFooter
              onConfirm={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              confirmText="Delete"
              cancelText="Cancel"
              confirmVariant="danger"
            />
          }
        >
          <p class="text-secondary">
            Are you sure you want to delete your account? This will permanently remove
            all your data, including your profile, songs, and achievements.
          </p>
        </Modal>
      </>
    )
  },
}

// Success Variant
export const SuccessVariant: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show Success</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Payment Successful!"
          description="Your transaction has been completed."
          variant="success"
          hideCloseButton
        >
          <div class="text-center space-y-4">
            <div class="text-6xl">🎉</div>
            <p class="text-secondary">
              You've successfully purchased 100 credits. They've been added to your account.
            </p>
            <Button onClick={() => setOpen(false)} fullWidth>
              Continue
            </Button>
          </div>
        </Modal>
      </>
    )
  },
}

// Confirm Modal Utility
export const ConfirmModalExample: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    const [loading, setLoading] = createSignal(false)
    
    const handleConfirm = () => {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setOpen(false)
      }, 2000)
    }
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Delete Item</Button>
        <ConfirmModal
          open={open()}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Delete Item?"
          description="This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          confirmLoading={loading()}
        />
      </>
    )
  },
}

// Long Content with Scroll
export const LongContent: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Long Modal</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Terms of Service"
          description="Please read and accept our terms"
          footer={
            <ModalFooter
              onConfirm={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              confirmText="Accept"
              cancelText="Decline"
            />
          }
        >
          <div class="space-y-4">
            {Array.from({ length: 20 }, (_, i) => (
              <p class="text-secondary">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
                nisi ut aliquip ex ea commodo consequat. Section {i + 1}.
              </p>
            ))}
          </div>
        </Modal>
      </>
    )
  },
}

// Custom Close Behavior
export const CustomCloseBehavior: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal (No Backdrop Close)</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Important Notice"
          description="You must click the button to close this modal"
          closeOnBackdropClick={false}
          closeOnEscape={false}
        >
          <p class="text-secondary mb-4">
            This modal cannot be closed by clicking the backdrop or pressing ESC.
            You must use the close button or the action buttons.
          </p>
          <Button onClick={() => setOpen(false)} fullWidth>
            I Understand
          </Button>
        </Modal>
      </>
    )
  },
}