import { createMemo } from 'solid-js';
import { useAuth } from '../context';

export function useAuthStatus() {
  const auth = useAuth();

  const hasCredits = createMemo(() => {
    if (!auth.user) return false;
    return auth.user.creditsUsed < auth.user.creditsLimit;
  });

  const creditsRemaining = createMemo(() => {
    if (!auth.user) return 0;
    return Math.max(0, auth.user.creditsLimit - auth.user.creditsUsed);
  });

  const isSubscribed = createMemo(() => {
    if (!auth.user) return false;
    return auth.user.subscriptionStatus === 'active';
  });

  const isTrialUser = createMemo(() => {
    if (!auth.user) return false;
    return auth.user.subscriptionStatus === 'trial';
  });

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    user: auth.user,
    hasCredits: hasCredits(),
    creditsRemaining: creditsRemaining(),
    isSubscribed: isSubscribed(),
    isTrialUser: isTrialUser(),
    provider: auth.provider,
  };
}