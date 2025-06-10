import { Hono } from 'hono';
import type { Env, User } from '../../types';
import { SignJWT } from 'jose';

// Create test environment
export function createTestEnv(): Env {
  return {
    DB: createMockDB(),
    ENVIRONMENT: 'test' as const,
    JWT_SECRET: 'test-secret-key-for-testing-only',
    GENIUS_API_KEY: 'test-genius-key',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
    DEEPGRAM_API_KEY: 'test-deepgram-key',
    VENICE_API_KEY: 'test-venice-key',
  };
}

// Create mock D1 database
export function createMockDB(): D1Database {
  return {
    prepare: (_query: string) => ({
      bind: (..._params: any[]) => ({
        first: async () => {
          // Mock implementation
          return null;
        },
        all: async () => {
          // Mock implementation
          return { results: [] };
        },
        run: async () => {
          // Mock implementation
          return { success: true };
        },
      }),
    }),
    batch: async (statements: any[]) => {
      // Mock batch operations
      return statements.map(() => ({ success: true }));
    },
    exec: async (_query: string) => {
      // Mock exec
      return { count: 0, duration: 0 };
    },
    withSession: async <T>(fn: (tx: D1Database) => Promise<T>) => {
      // Mock session - just run the function with the same DB
      return fn(createMockDB());
    },
    dump: async () => {
      // Mock dump
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

// Create test user
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    subscriptionStatus: 'trial',
    subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    creditsUsed: 0,
    creditsLimit: 100,
    creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    unlockKeyId: undefined,
    unlockLockAddress: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

// Create test JWT token
export async function createTestToken(user: User, env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  
  const jwt = await new SignJWT({
    userId: user.id,
    email: user.email,
    walletAddress: user.walletAddress,
    subscriptionStatus: user.subscriptionStatus,
    creditsRemaining: Math.max(0, user.creditsLimit - user.creditsUsed),
    type: 'extension_token',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setSubject(user.id)
    .sign(secret);

  return `scarlett_${jwt}`;
}

// Create test request
export function createTestRequest(
  method: string,
  path: string,
  options?: {
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  }
): Request {
  const url = new URL(path, 'http://localhost');
  
  if (options?.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = new Headers(options?.headers || {});
  
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Request(url.toString(), {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

// Create authenticated request
export async function createAuthenticatedRequest(
  method: string,
  path: string,
  user: User,
  env: Env,
  options?: {
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  }
): Promise<Request> {
  const token = await createTestToken(user, env);
  
  return createTestRequest(method, path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// Test app helper
export function createTestApp<T extends Env = Env>() {
  return new Hono<{ Bindings: T }>();
}