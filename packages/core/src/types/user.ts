// User and authentication types

export interface User {
  id: string;
  email: string;
  walletAddress?: string;
  displayName?: string;
  avatarUrl?: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  subscriptionExpiresAt?: string;
  trialExpiresAt?: string;
  creditsUsed: number;
  creditsLimit: number;
  creditsResetAt: string;
  unlockKeyId?: string;
  unlockLockAddress?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  walletAddress?: string;
  subscriptionStatus: string;
  creditsRemaining: number;
  type: 'extension_token' | 'api_key';
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: AuthProvider) => Promise<void>;
  logout: () => Promise<void>;
}

export type AuthProvider = 'farcaster' | 'wallet' | 'email';

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  bio?: string;
}