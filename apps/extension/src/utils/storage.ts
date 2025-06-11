// Using browser.storage API directly for simplicity
import { browser } from 'wxt/browser';

// Helper to get auth token
export async function getAuthToken(): Promise<string | null> {
  const result = await browser.storage.local.get('authToken');
  return result.authToken || null;
}

// Helper to set auth token
export async function setAuthToken(token: string): Promise<void> {
  await browser.storage.local.set({ authToken: token });
}

// Helper to get installation state
export async function getInstallationState(): Promise<{
  completed: boolean;
  jwtVerified: boolean;
  timestamp?: number;
}> {
  const result = await browser.storage.local.get('installationState');
  return result.installationState || {
    completed: false,
    jwtVerified: false,
  };
}

// Helper to set installation state
export async function setInstallationState(state: {
  completed: boolean;
  jwtVerified: boolean;
  timestamp?: number;
}): Promise<void> {
  await browser.storage.local.set({ installationState: state });
}

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token && token.startsWith('scarlett_');
}

// Helper to clear auth data
export async function clearAuth(): Promise<void> {
  await browser.storage.local.remove(['authToken', 'installationState']);
}