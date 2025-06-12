import type { User, AuthProvider as AuthProviderType } from '@scarlett/core';

export interface AuthProviderConfig {
  apiUrl: string;
  onError?: (error: Error) => void;
}

export abstract class BaseAuthProvider {
  protected apiUrl: string;
  protected onError?: (error: Error) => void;

  constructor(config: AuthProviderConfig) {
    this.apiUrl = config.apiUrl;
    this.onError = config.onError;
  }

  abstract get type(): AuthProviderType;
  abstract login(): Promise<{ token: string; user: User }>;
  abstract logout(): Promise<void>;
  abstract isAvailable(): boolean;
  abstract getDisplayName(): string;

  protected handleError(error: Error): void {
    console.error(`[${this.type}] Auth error:`, error);
    if (this.onError) {
      this.onError(error);
    }
  }
}