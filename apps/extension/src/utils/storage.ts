import { defineExtensionStorage } from '@wxt-dev/storage';

// Define storage for the auth token
export const authToken = defineExtensionStorage<string>('local:authToken', {
  fallback: '',
});

// Define storage for installation state
export const installationState = defineExtensionStorage<{
  completed: boolean;
  jwtVerified: boolean;
  timestamp?: number;
}>('local:installationState', {
  fallback: {
    completed: false,
    jwtVerified: false,
  },
});

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const token = await authToken.getValue();
  return !!token && token.startsWith('scarlett_');
}

// Helper to clear auth data
export async function clearAuth(): Promise<void> {
  await authToken.removeValue();
  await installationState.setValue({
    completed: false,
    jwtVerified: false,
  });
}