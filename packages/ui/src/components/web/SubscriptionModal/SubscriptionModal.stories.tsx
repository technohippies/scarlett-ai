import type { Meta, StoryObj } from '@storybook/html';
import type { SubscriptionModalProps } from './SubscriptionModal';
import { SubscriptionModal } from './SubscriptionModal';
import { solidStory } from '../../../utils/storybook';
import { createSignal } from 'solid-js';

const meta: Meta<SubscriptionModalProps> = {
  title: 'Web/SubscriptionModal',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<SubscriptionModalProps>;

const InteractiveModal = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
      >
        Open Subscription Modal
      </button>
      
      <SubscriptionModal
        isOpen={isOpen()}
        hasTrialAvailable={true}
        onClose={() => setIsOpen(false)}
        onSubscribe={() => {
          console.log('Subscribe clicked');
          setIsOpen(false);
        }}
      />
    </>
  );
};

export const TrialAvailable: Story = solidStory({
  render: () => <InteractiveModal />,
});

const ActiveSubscriptionModal = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
      >
        Open Active Subscription Modal
      </button>
      
      <SubscriptionModal
        isOpen={isOpen()}
        isActive={true}
        onClose={() => setIsOpen(false)}
        onManage={() => {
          console.log('Manage clicked');
          setIsOpen(false);
        }}
        onSubscribe={() => {}}
      />
    </>
  );
};

export const ActiveSubscription: Story = solidStory({
  render: () => <ActiveSubscriptionModal />,
});

const ProcessingModal = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  const [isProcessing, setIsProcessing] = createSignal(false);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
      >
        Open Processing Modal
      </button>
      
      <SubscriptionModal
        isOpen={isOpen()}
        hasTrialAvailable={true}
        isProcessing={isProcessing()}
        onClose={() => setIsOpen(false)}
        onSubscribe={() => {
          setIsProcessing(true);
          console.log('Processing subscription...');
          setTimeout(() => {
            setIsProcessing(false);
            setIsOpen(false);
          }, 2000);
        }}
      />
    </>
  );
};

export const Processing: Story = solidStory({
  render: () => <ProcessingModal />,
});

const NotConnectedModal = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
      >
        Open Not Connected Modal
      </button>
      
      <SubscriptionModal
        isOpen={isOpen()}
        isConnected={false}
        onClose={() => setIsOpen(false)}
        onConnectWallet={() => {
          console.log('Connect wallet clicked');
          // Simulate connection
          setTimeout(() => setIsOpen(false), 1000);
        }}
        onSubscribe={() => {}}
      />
    </>
  );
};

export const NotConnected: Story = solidStory({
  render: () => <NotConnectedModal />,
});

const ConnectedModal = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
      >
        Open Connected Wallet Modal
      </button>
      
      <SubscriptionModal
        isOpen={isOpen()}
        isConnected={true}
        walletAddress="0x1234567890123456789012345678901234567890"
        hasTrialAvailable={false}
        onClose={() => setIsOpen(false)}
        onSubscribe={() => {
          console.log('Subscribe with Unlock clicked');
          setIsOpen(false);
        }}
        onConnectWallet={() => {}}
      />
    </>
  );
};

export const ConnectedWallet: Story = solidStory({
  render: () => <ConnectedModal />,
});