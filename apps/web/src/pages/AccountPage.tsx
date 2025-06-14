import { Show, createSignal, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Button, Header, SubscriptionSlider } from '@scarlett/ui';
import { useWeb3 } from '../contexts/Web3Context';
import { useFreeTrial } from '../hooks/useFreeTrial';
import { formatTimeLeft } from '../utils/time';
import { useNavigate } from '@solidjs/router';
import { Paywall } from '@unlock-protocol/paywall';

const LOCK_ADDRESS = import.meta.env.VITE_UNLOCK_LOCK_ADDRESS;

// Unlock Protocol configuration
const unlockConfig = {
  locks: {
    "0xdeaba71ca5e1c10d83eef91d3d0899607646e963": {
      network: 84532, // Base Sepolia
      name: "Unlimited Karaoke",
      recurringPayments: "forever",
      emailRequired: true
    }
  },
  icon: "https://storage.unlock-protocol.com/4dc13d4b-d59d-46ee-b06f-36ed4974d3fd",
  title: "Unlimited Karaoke",
  referrer: "0xB0dD2a6FAB0180C8b2fc4f144273Cc693d7896Ed",
  skipSelect: true,
  hideSoldOut: false,
  pessimistic: false,
  skipRecipient: true,
  persistentCheckout: false
};

export const AccountPage: Component = () => {
  const navigate = useNavigate();
  const { account, provider, signer, connectWallet, disconnectWallet } = useWeb3();
  const { data: trialData, cancelAndRefund } = useFreeTrial(
    LOCK_ADDRESS,
    provider(),
    signer(),
    account()
  );
  
  const [isCancelling, setIsCancelling] = createSignal(false);
  const [cancelError, setCancelError] = createSignal<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = createSignal(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = createSignal(false);

  const formattedTimeLeft = createMemo(() => {
    const data = trialData();
    if (!data.isTrialActive || data.timeLeft <= 0) return null;
    
    const days = Math.floor(data.timeLeft / 86400);
    const hours = Math.floor((data.timeLeft % 86400) / 3600);
    const minutes = Math.floor((data.timeLeft % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  });

  const handleCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    
    try {
      await cancelAndRefund();
      setCancelSuccess(true);
      // Redirect after successful cancellation
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      console.error('Cancellation failed:', error);
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          setCancelError('The lock has insufficient funds for refund. Please contact support.');
        } else {
          setCancelError(error.message);
        }
      } else {
        setCancelError('Failed to cancel subscription');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessingSubscription(true);
    try {
      const paywall = new Paywall(unlockConfig);
      
      const handleStatus = (e: any) => {
        console.log('Unlock status:', e.detail);
        if (e.detail.state === 'unlocked') {
          setShowSubscriptionModal(false);
          window.removeEventListener('unlockProtocol.status', handleStatus);
          // Refresh the page to update subscription status
          window.location.reload();
        }
      };
      
      window.addEventListener('unlockProtocol.status', handleStatus);
      
      paywall.loadCheckoutModal();
      
      setTimeout(() => {
        setIsProcessingSubscription(false);
      }, 1000);
      
    } catch (error) {
      console.error('Subscription purchase failed:', error);
      setIsProcessingSubscription(false);
    }
  };

  return (
    <div class="min-h-screen bg-base flex flex-col relative">
      {/* Back button - positioned absolutely like song page */}
      <button
        onClick={() => navigate('/')}
        class="absolute top-4 left-2 z-50 p-2 text-white drop-shadow-lg hover:text-white/90 transition-colors"
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Header with padding to account for back button */}
      <header class="bg-surface border-b border-subtle px-4 py-6">
        <h1 class="text-2xl font-bold text-center">Account</h1>
      </header>
      
      <main class="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        
        <Show
          when={account()}
          fallback={
            <div class="bg-surface rounded-lg p-8 text-center">
              <p class="text-secondary mb-6">Connect your wallet to manage your subscription</p>
              <Button variant="primary" onClick={connectWallet}>
                Connect Wallet
              </Button>
            </div>
          }
        >
          <div class="space-y-6">
            {/* Wallet Info */}
            <div class="bg-surface rounded-lg p-6">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-lg font-semibold text-primary">Connected Wallet</h2>
                <Show when={typeof window !== 'undefined' && window.ethereum}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      disconnectWallet();
                      navigate('/');
                    }}
                  >
                    Disconnect
                  </Button>
                </Show>
              </div>
              <p class="text-sm text-secondary font-mono">
                {account()?.slice(0, 6)}...{account()?.slice(-4)}
              </p>
            </div>

            {/* Subscription Status */}
            <div class="bg-surface rounded-lg p-6">
              <h2 class="text-lg font-semibold text-primary mb-4">Subscription Status</h2>
              
              <Show
                when={!trialData().isLoading}
                fallback={
                  <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                  </div>
                }
              >
                <Show
                  when={!trialData().error}
                  fallback={
                    <p class="text-secondary">{trialData().error}</p>
                  }
                >
                  <Show
                    when={trialData().tokenId}
                    fallback={
                      <div class="text-center py-8">
                        <p class="text-secondary mb-4">No active subscription</p>
                        <Button variant="primary" onClick={() => setShowSubscriptionModal(true)}>
                          Start Free Trial
                        </Button>
                      </div>
                    }
                  >
                    <div class="space-y-4">
                      {/* Trial Status */}
                      <Show when={trialData().isTrialActive}>
                        <div class="bg-accent-primary/10 rounded-lg p-4 border border-accent-primary/20">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-accent-primary">Free Trial Active</span>
                            <span class="text-sm font-semibold text-accent-primary">
                              {formattedTimeLeft()} left
                            </span>
                          </div>
                          <p class="text-xs text-secondary">
                            Cancel anytime before the trial ends for a full refund
                          </p>
                        </div>
                      </Show>

                      {/* Refund Amount */}
                      <Show when={parseFloat(trialData().refundAmount) > 0}>
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-secondary">Refund amount</span>
                          <span class="text-sm font-medium text-primary">
                            {trialData().refundAmount} ETH
                          </span>
                        </div>
                      </Show>

                      {/* Cancel Button */}
                      <Show when={!cancelSuccess()}>
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={handleCancel}
                          disabled={isCancelling() || parseFloat(trialData().refundAmount) === 0}
                        >
                          <Show
                            when={!isCancelling()}
                            fallback={
                              <>
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                Cancelling...
                              </>
                            }
                          >
                            Cancel Subscription
                          </Show>
                        </Button>
                      </Show>

                      {/* Success Message */}
                      <Show when={cancelSuccess()}>
                        <div class="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                          <p class="text-sm text-green-500 font-medium">
                            ✓ Subscription cancelled successfully
                          </p>
                          <p class="text-xs text-green-400 mt-1">
                            Redirecting to home...
                          </p>
                        </div>
                      </Show>

                      {/* Error Message */}
                      <Show when={cancelError()}>
                        <div class="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                          <p class="text-sm text-red-500">
                            {cancelError()}
                          </p>
                        </div>
                      </Show>

                      {/* Warning for expired trial */}
                      <Show when={!trialData().isTrialActive && trialData().tokenId}>
                        <div class="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                          <p class="text-sm text-yellow-500">
                            Free trial period has ended. Cancellation will result in a partial refund.
                          </p>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </Show>
              </Show>
            </div>
            
            {/* Sign Out Button */}
            <div class="bg-surface rounded-lg p-6">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  disconnectWallet();
                  navigate('/');
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </Show>
      </main>
      
      <SubscriptionSlider
        isOpen={showSubscriptionModal()}
        hasTrialAvailable={true}
        isConnected={!!account()}
        walletAddress={account()}
        isProcessing={isProcessingSubscription()}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscribe}
        onConnectWallet={connectWallet}
      />
    </div>
  );
};