import type { Meta, StoryObj } from '@storybook/html';
import type { SubscriptionSliderProps } from './SubscriptionSlider';
import { SubscriptionSlider } from './SubscriptionSlider';
import { solidStory } from '../../../utils/storybook';
import { createSignal, Show } from 'solid-js';
import { Button } from '../../common/Button';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<SubscriptionSliderProps> = {
  title: 'Web/SubscriptionSlider',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isOpen: { control: 'boolean' },
    isActive: { control: 'boolean' },
    hasTrialAvailable: { control: 'boolean' },
    isProcessing: { control: 'boolean' },
    isConnected: { control: 'boolean' },
    walletAddress: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<SubscriptionSliderProps>;

// Simulated song page component
const SongPage = (props: { onSubscribe?: () => void }) => {
  const [showSlider, setShowSlider] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [isConnected, setIsConnected] = createSignal(false);
  const [walletAddress, setWalletAddress] = createSignal<string>('');
  const [hasSubscription, setHasSubscription] = createSignal(false);

  const handleStart = () => {
    if (!hasSubscription()) {
      setShowSlider(true);
    } else {
      console.log('Starting song playback...');
    }
  };

  const handleConnectWallet = async () => {
    setIsProcessing(true);
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsConnected(true);
    setWalletAddress('0x1234567890123456789012345678901234567890');
    setIsProcessing(false);
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    // Simulate subscription purchase
    await new Promise(resolve => setTimeout(resolve, 2000));
    setHasSubscription(true);
    setShowSlider(false);
    setIsProcessing(false);
    // Auto-start the song after subscription
    console.log('Subscription complete! Starting song...');
    props.onSubscribe?.();
  };

  return (
    <div class="min-h-screen bg-base text-primary">
      {/* Mock song page UI */}
      <div class="p-8 max-w-2xl mx-auto">
        <div class="space-y-6">
          {/* Song artwork placeholder */}
          <div class="aspect-square bg-surface rounded-lg flex items-center justify-center">
            <div class="text-center">
              <div class="w-32 h-32 bg-elevated rounded-full mx-auto mb-4" />
              <p class="text-secondary">Album Art</p>
            </div>
          </div>
          
          {/* Song info */}
          <div class="text-center space-y-2">
            <h1 class="text-3xl font-bold">Amazing Song Title</h1>
            <p class="text-xl text-secondary">Artist Name</p>
          </div>
          
          {/* Start button */}
          <div class="flex justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStart}
              class="px-12 py-4 text-lg"
            >
              <Show when={hasSubscription()} fallback="Start">
                Start Playing
              </Show>
            </Button>
          </div>
          
          <Show when={hasSubscription()}>
            <p class="text-center text-accent-primary">
              ✓ You have an active subscription!
            </p>
          </Show>
        </div>
      </div>
      
      {/* Subscription slider */}
      <SubscriptionSlider
        isOpen={showSlider()}
        hasTrialAvailable={true}
        isConnected={isConnected()}
        walletAddress={walletAddress()}
        isProcessing={isProcessing()}
        onClose={() => setShowSlider(false)}
        onConnectWallet={handleConnectWallet}
        onSubscribe={handleSubscribe}
      />
    </div>
  );
};

export const DefaultFlow: Story = {
  render: (args, context) => withI18n(SongPage)({ onSubscribe: () => console.log('Song started!') }, context),
};

// Story showing the slider already open
const OpenSliderStory = () => {
  const [isOpen, setIsOpen] = createSignal(true);
  const [isConnected, setIsConnected] = createSignal(false);
  const [walletAddress, setWalletAddress] = createSignal('');

  return (
    <div class="min-h-screen bg-base p-8">
      <h1 class="text-2xl font-bold text-primary mb-4">Subscription Slider Demo</h1>
      <Button onClick={() => setIsOpen(true)}>
        Open Subscription Slider
      </Button>
      
      <SubscriptionSlider
        isOpen={isOpen()}
        hasTrialAvailable={true}
        isConnected={isConnected()}
        walletAddress={walletAddress()}
        onClose={() => setIsOpen(false)}
        onConnectWallet={() => {
          setIsConnected(true);
          setWalletAddress('0x1234567890123456789012345678901234567890');
        }}
        onSubscribe={() => {
          console.log('Subscribe clicked');
          setIsOpen(false);
        }}
      />
    </div>
  );
};

export const SliderOnly: Story = {
  render: (args, context) => withI18n(OpenSliderStory)({}, context),
};

// Story with active subscription
const ActiveSubscriptionStory = () => {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <div class="min-h-screen bg-base p-8">
      <h1 class="text-2xl font-bold text-primary mb-4">Active Subscription Demo</h1>
      <Button onClick={() => setIsOpen(true)}>
        Manage Subscription
      </Button>
      
      <SubscriptionSlider
        isOpen={isOpen()}
        isActive={true}
        onClose={() => setIsOpen(false)}
        onManage={() => {
          console.log('Manage subscription clicked');
          setIsOpen(false);
        }}
        onSubscribe={() => {}}
      />
    </div>
  );
};

export const ActiveSubscription: Story = {
  render: (args, context) => withI18n(ActiveSubscriptionStory)({}, context),
};