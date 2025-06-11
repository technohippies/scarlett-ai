import { createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { setAuthToken, getAuthToken, setInstallationState, getInstallationState } from '../../utils/storage';

export const OnInstallApp: Component = () => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const setupDemoAccount = async () => {
    try {
      // Use the hardcoded demo token
      const demoToken = 'scarlett_test_demo_user_12345';
      
      // Store token
      await setAuthToken(demoToken);
      await setInstallationState({
        completed: true,
        jwtVerified: true,
        timestamp: Date.now(),
      });

      console.log('[OnInstall] Demo account setup complete');
      
      // Wait a moment to show success
      setTimeout(() => {
        window.close();
      }, 2000);
      
    } catch (e: any) {
      console.error('[OnInstall] Setup failed:', e);
      setError(e.message || 'Failed to set up extension');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing installation on mount
  onMount(async () => {
    const existingToken = await getAuthToken();
    const state = await getInstallationState();
    
    if (existingToken && state?.completed) {
      console.log('[OnInstall] Already installed, closing window');
      window.close();
      return;
    }
    
    // Automatically set up demo account
    await setupDemoAccount();
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
      <div class="max-w-2xl w-full p-12 text-center">
        {/* Logo/Header */}
        <div class="mb-12">
          <div class="text-8xl mb-6">🎤</div>
          <h1 class="text-6xl font-bold text-white mb-4">
            Scarlett Karaoke
          </h1>
          <p class="text-xl text-gray-400">
            AI-powered karaoke for SoundCloud
          </p>
        </div>

        {/* Status */}
        {isLoading() ? (
          <div class="space-y-8">
            <div class="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p class="text-gray-400 text-xl">
              Setting up your account...
            </p>
          </div>
        ) : error() ? (
          <div class="space-y-6">
            <div class="p-6 bg-red-900/20 border border-red-800 rounded-xl">
              <p class="text-red-400 text-lg">{error()}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              class="text-gray-400 hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div class="space-y-8">
            <div class="text-8xl mb-6">🎉</div>
            <h2 class="text-4xl font-semibold text-white mb-4">
              You're All Set!
            </h2>
            <p class="text-gray-400 text-xl">
              Extension setup complete. Closing in a moment...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};