import { Component, Show } from 'solid-js';
import { cn } from '../../../utils/cn';

export type OnboardingStep = 'token-input' | 'welcome' | 'complete';

export interface OnboardingFlowProps {
  step: OnboardingStep;
  error?: string | null;
  tokenVerified?: boolean;
  onTokenSubmit: (token: string) => void;
  onGetStarted: () => void;
  onComplete: () => void;
  defaultToken?: string;
  tokenPlaceholder?: string;
  getTokenUrl?: string;
  class?: string;
}

export const OnboardingFlow: Component<OnboardingFlowProps> = (props) => {
  let tokenInputRef: HTMLInputElement | undefined;

  const handleTokenSubmit = () => {
    const token = tokenInputRef?.value.trim();
    if (token) {
      props.onTokenSubmit(token);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTokenSubmit();
    }
  };

  return (
    <div class={cn(
      'min-h-screen bg-gradient-to-br from-accent-primary to-accent-secondary',
      'flex items-center justify-center p-4',
      props.class
    )}>
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 md:p-12">
        {/* Header */}
        <div class="text-center mb-8">
          <h1 class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent mb-2">
            🎤 Scarlett Karaoke
          </h1>
          <p class="text-lg text-secondary">
            AI-powered karaoke learning for SoundCloud
          </p>
        </div>

        {/* Progress Indicator */}
        <div class="flex justify-center mb-8">
          <div class="flex gap-2">
            <div class={cn(
              'w-3 h-3 rounded-full transition-colors',
              props.step === 'token-input' 
                ? 'bg-accent-primary' 
                : props.tokenVerified 
                  ? 'bg-accent-success' 
                  : 'bg-muted'
            )} />
            <div class={cn(
              'w-3 h-3 rounded-full transition-colors',
              ['welcome', 'complete'].includes(props.step) 
                ? 'bg-accent-primary' 
                : 'bg-muted'
            )} />
            <div class={cn(
              'w-3 h-3 rounded-full transition-colors',
              props.step === 'complete' 
                ? 'bg-accent-success' 
                : 'bg-muted'
            )} />
          </div>
        </div>

        {/* Error Display */}
        <Show when={props.error}>
          <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 text-center">{props.error}</p>
          </div>
        </Show>

        {/* Content */}
        <div class="text-center">
          {/* Token Input Step */}
          <Show when={props.step === 'token-input'}>
            <div>
              <div class="text-6xl mb-4">🔑</div>
              <h2 class="text-2xl md:text-3xl font-semibold text-primary mb-4">
                Enter Your Access Token
              </h2>
              <p class="text-secondary mb-8 max-w-sm mx-auto">
                Paste your access token to unlock unlimited karaoke sessions
              </p>

              <div class="my-8 space-y-4">
                <div class="bg-surface border-2 border-subtle rounded-lg p-4 transition-colors hover:border-default">
                  <input
                    ref={tokenInputRef!}
                    type="text"
                    placeholder={props.tokenPlaceholder || "scarlett_..."}
                    value={props.defaultToken || ""}
                    onKeyDown={handleKeyDown}
                    class="w-full border-none bg-transparent outline-none font-mono text-sm text-primary placeholder:text-muted"
                  />
                </div>
                
                <div class="flex gap-3 justify-center">
                  <button
                    onClick={handleTokenSubmit}
                    class="bg-gradient-to-r from-accent-primary to-accent-secondary text-white px-8 py-3 rounded-lg font-semibold hover:scale-105 transition-transform shadow-lg"
                  >
                    Verify Token
                  </button>
                  <button
                    onClick={() => window.open(props.getTokenUrl || 'https://scarlettx.xyz', '_blank')}
                    class="bg-surface text-primary px-6 py-3 rounded-lg font-semibold hover:bg-highlight transition-colors"
                  >
                    Get Token
                  </button>
                </div>
              </div>

              <div class="bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 rounded-lg p-4 max-w-sm mx-auto">
                <p class="text-sm text-purple-700 font-medium">
                  💡 <strong>Demo Mode:</strong> Use the prefilled token to try Scarlett free
                </p>
              </div>
            </div>
          </Show>

          {/* Welcome Step */}
          <Show when={props.step === 'welcome'}>
            <div class="space-y-6">
              <div class="text-6xl mb-4">🎉</div>
              <h2 class="text-2xl md:text-3xl font-semibold text-primary">
                Welcome to Scarlett!
              </h2>
              <p class="text-secondary max-w-sm mx-auto">
                Your token has been verified. You're all set to start your karaoke journey on SoundCloud!
              </p>

              <Show when={props.tokenVerified}>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 max-w-sm mx-auto">
                  <div class="text-green-700 font-semibold mb-2">
                    ✅ Access Granted
                  </div>
                  <div class="text-sm text-gray-600">
                    Ready to sing along to your favorite tracks!
                  </div>
                </div>
              </Show>

              <button
                onClick={props.onGetStarted}
                class="bg-gradient-to-r from-accent-primary to-accent-secondary text-white px-12 py-4 rounded-lg font-semibold text-lg hover:scale-105 transition-transform shadow-lg"
              >
                Get Started
              </button>
            </div>
          </Show>

          {/* Complete Step */}
          <Show when={props.step === 'complete'}>
            <div class="space-y-6">
              <div class="text-6xl mb-4">🚀</div>
              <h2 class="text-2xl md:text-3xl font-semibold text-primary">
                You're All Set!
              </h2>
              <p class="text-secondary max-w-sm mx-auto">
                Head to SoundCloud and start singing! Look for the karaoke widget on any supported track.
              </p>

              <button
                onClick={props.onComplete}
                class="bg-gradient-to-r from-green-500 to-cyan-500 text-white px-12 py-4 rounded-lg font-semibold text-lg hover:scale-105 transition-transform shadow-lg"
              >
                Start Karaoke
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};