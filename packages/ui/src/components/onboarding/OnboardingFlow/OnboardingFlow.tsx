import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { Button } from '../../common/Button';

export type OnboardingStep = 'connect-wallet' | 'generating-token' | 'complete';

export interface OnboardingFlowProps {
  step: OnboardingStep;
  error?: string | null;
  walletAddress?: string | null;
  token?: string | null;
  onConnectWallet: () => void;
  onUseTestMode: () => void;
  onUsePrivateKey: (privateKey: string) => void;
  onComplete: () => void;
  isConnecting?: boolean;
  isGenerating?: boolean;
  class?: string;
}

export const OnboardingFlow: Component<OnboardingFlowProps> = (props) => {
  const [showTestOption, setShowTestOption] = createSignal(false);
  const [showPrivateKeyInput, setShowPrivateKeyInput] = createSignal(false);
  const [privateKey, setPrivateKey] = createSignal('');

  return (
    <div class={cn(
      'min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center',
      props.class
    )}>
      <div class="max-w-2xl w-full p-12">
        {/* Logo/Header */}
        <div class="text-center mb-12">
          <div class="text-8xl mb-6">🎤</div>
          <h1 class="text-6xl font-bold text-white mb-4">
            Scarlett Karaoke
          </h1>
          <p class="text-xl text-gray-400">
            AI-powered karaoke for SoundCloud
          </p>
        </div>

        {/* Progress Dots */}
        <div class="flex justify-center mb-12">
          <div class="flex gap-3">
            <div class={cn(
              'w-3 h-3 rounded-full transition-all duration-300',
              props.step === 'connect-wallet' 
                ? 'bg-purple-500 w-12' 
                : props.walletAddress 
                  ? 'bg-green-500' 
                  : 'bg-gray-600'
            )} />
            <div class={cn(
              'w-3 h-3 rounded-full transition-all duration-300',
              props.step === 'generating-token' 
                ? 'bg-purple-500 w-12' 
                : props.token 
                  ? 'bg-green-500' 
                  : 'bg-gray-600'
            )} />
            <div class={cn(
              'w-3 h-3 rounded-full transition-all duration-300',
              props.step === 'complete' 
                ? 'bg-green-500 w-12' 
                : 'bg-gray-600'
            )} />
          </div>
        </div>

        {/* Error Display */}
        <Show when={props.error}>
          <div class="mb-8 p-6 bg-red-900/20 border border-red-800 rounded-xl">
            <p class="text-red-400 text-center text-lg">{props.error}</p>
          </div>
        </Show>

        {/* Content */}
        <div class="space-y-6">
          {/* Connect Wallet Step */}
          <Show when={props.step === 'connect-wallet'}>
            <div class="text-center space-y-8">
              <div>
                <h2 class="text-4xl font-semibold text-white mb-4">
                  Connect Your Wallet
                </h2>
                <p class="text-gray-400 text-lg max-w-md mx-auto">
                  Connect your wallet to get started
                </p>
              </div>

              <div class="space-y-4 max-w-md mx-auto">
                <Button
                  onClick={props.onConnectWallet}
                  disabled={props.isConnecting}
                  size="lg"
                  class="w-full h-16 text-lg"
                >
                  {props.isConnecting ? (
                    <span class="flex items-center justify-center gap-2">
                      <span class="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    <span class="flex items-center justify-center gap-2">
                      <span>🦊</span>
                      Connect with MetaMask
                    </span>
                  )}
                </Button>

                <Show when={!showTestOption() && !showPrivateKeyInput()}>
                  <div class="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowTestOption(true)}
                      class="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Use demo mode
                    </button>
                    <span class="text-gray-600">|</span>
                    <button
                      onClick={() => setShowPrivateKeyInput(true)}
                      class="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Use private key
                    </button>
                  </div>
                </Show>

                <Show when={showTestOption()}>
                  <div class="pt-6 space-y-4">
                    <div class="border-t border-gray-800 pt-6">
                      <Button
                        onClick={props.onUseTestMode}
                        variant="secondary"
                        size="lg"
                        class="w-full h-14"
                      >
                        Continue with Demo Mode
                      </Button>
                      <button
                        onClick={() => setShowTestOption(false)}
                        class="text-gray-500 hover:text-gray-300 transition-colors mt-3"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </Show>

                <Show when={showPrivateKeyInput()}>
                  <div class="pt-6 space-y-4">
                    <div class="border-t border-gray-800 pt-6">
                      <input
                        type="password"
                        value={privateKey()}
                        onInput={(e) => setPrivateKey(e.currentTarget.value)}
                        placeholder="Enter private key"
                        class="w-full h-14 px-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                      <Button
                        onClick={() => props.onUsePrivateKey(privateKey())}
                        disabled={!privateKey() || privateKey().length !== 64}
                        variant="secondary"
                        size="lg"
                        class="w-full h-14 mt-3"
                      >
                        Connect with Private Key
                      </Button>
                      <button
                        onClick={() => {
                          setShowPrivateKeyInput(false);
                          setPrivateKey('');
                        }}
                        class="text-gray-500 hover:text-gray-300 transition-colors mt-3"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </Show>
              </div>

            </div>
          </Show>

          {/* Generating Token Step */}
          <Show when={props.step === 'generating-token'}>
            <div class="text-center space-y-8">
              <div>
                <h2 class="text-4xl font-semibold text-white mb-4">
                  Setting Up Your Account
                </h2>
                <Show when={props.walletAddress}>
                  <p class="text-gray-400 text-lg mb-3">
                    Connected wallet:
                  </p>
                  <code class="text-lg text-purple-400 bg-gray-800 px-4 py-2 rounded-lg font-mono inline-block">
                    {props.walletAddress?.slice(0, 6)}...{props.walletAddress?.slice(-4)}
                  </code>
                </Show>
              </div>

              <div class="py-12">
                <div class="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>

              <p class="text-gray-400 text-xl">
                {props.isGenerating 
                  ? 'Generating your access token...' 
                  : 'Verifying your account...'}
              </p>
            </div>
          </Show>

          {/* Complete Step */}
          <Show when={props.step === 'complete'}>
            <div class="text-center space-y-8">
              <div class="text-8xl mb-6">🎉</div>
              
              <div>
                <h2 class="text-4xl font-semibold text-white mb-4">
                  You're All Set!
                </h2>
                <p class="text-gray-400 text-xl max-w-md mx-auto mb-8">
                  Your account is ready. Time to sing!
                </p>
              </div>

              <div class="max-w-md mx-auto">
                <Button
                  onClick={props.onComplete}
                  size="lg"
                  class="w-full h-16 text-lg"
                >
                  Start Singing! 🚀
                </Button>
              </div>

              <p class="text-gray-500 mt-6">
                Look for the karaoke widget on any SoundCloud track
              </p>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};