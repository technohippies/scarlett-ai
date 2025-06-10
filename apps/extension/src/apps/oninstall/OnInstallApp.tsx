import { Component, createSignal } from 'solid-js';
import { OnboardingFlow, type OnboardingStep } from '@scarlett/ui';
import { authToken, installationState } from '../../utils/storage';

export const OnInstallApp: Component = () => {
  const [step, setStep] = createSignal<OnboardingStep>('token-input');
  const [error, setError] = createSignal<string | null>(null);
  const [tokenVerified, setTokenVerified] = createSignal(false);

  const handleTokenSubmit = async (token: string) => {
    console.log('[OnInstall] JWT Token submitted:', token.substring(0, 30) + '...');
    setError(null);

    try {
      // Validate token format
      if (token === 'scarlett_test_demo_user_12345' || token.startsWith('scarlett_')) {
        console.log('[OnInstall] JWT Token format valid');

        // Store token in extension storage
        try {
          await authToken.setValue(token);
          console.log('[OnInstall] ✅ JWT Token stored successfully');

          // Update installation state
          await installationState.setValue({
            completed: false,
            jwtVerified: true,
            timestamp: Date.now(),
          });
          console.log('[OnInstall] ✅ Installation state updated');
        } catch (error) {
          console.error('[OnInstall] ❌ Failed to store token:', error);
          throw error;
        }

        setTokenVerified(true);
        setStep('welcome');
      } else {
        throw new Error('Invalid token format. Token must start with "scarlett_"');
      }
    } catch (e: any) {
      console.error('[OnInstall] JWT verification failed:', e);
      setError(e.message || 'Token verification failed');
    }
  };

  const handleGetStarted = async () => {
    console.log('[OnInstall] Getting started...');
    
    // Mark installation as complete
    await installationState.setValue({
      completed: true,
      jwtVerified: true,
      timestamp: Date.now(),
    });

    setStep('complete');
  };

  const handleComplete = () => {
    console.log('[OnInstall] Installation complete, closing window');
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  return (
    <OnboardingFlow
      step={step()}
      error={error()}
      tokenVerified={tokenVerified()}
      onTokenSubmit={handleTokenSubmit}
      onGetStarted={handleGetStarted}
      onComplete={handleComplete}
      defaultToken="scarlett_test_demo_user_12345"
      tokenPlaceholder="scarlett_..."
      getTokenUrl="https://scarlettx.xyz"
    />
  );
};