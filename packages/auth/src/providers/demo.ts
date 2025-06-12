import { BaseAuthProvider } from './base';
import type { User } from '@scarlett/core';
import { createApiClient } from '@scarlett/api-client';

export class DemoAuthProvider extends BaseAuthProvider {
  private apiClient: ReturnType<typeof createApiClient>;

  constructor(config: Parameters<typeof createApiClient>[0]) {
    super(config);
    this.apiClient = createApiClient(config);
  }

  get type() {
    return 'email' as const; // Using 'email' as demo uses email-like IDs
  }

  getDisplayName(): string {
    return 'Demo';
  }

  isAvailable(): boolean {
    return true; // Demo is always available
  }

  async login(): Promise<{ token: string; user: User }> {
    try {
      // Get demo token
      const token = await this.apiClient.auth.getDemoToken();

      // Create a demo user object
      const user: User = {
        id: 'demo-user',
        email: 'demo@scarlett.ai',
        displayName: 'Demo User',
        subscriptionStatus: 'trial',
        creditsUsed: 0,
        creditsLimit: 10,
        creditsResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      return { token, user };
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    // Demo doesn't need logout
  }
}