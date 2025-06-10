import type { Context } from 'hono';
import { SignJWT, jwtVerify } from 'jose';

// Types
export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  display_name?: string;
  avatar_url?: string;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_expires_at?: string;
  trial_expires_at?: string;
  credits_used: number;
  credits_limit: number;
  credits_reset_at: string;
  unlock_key_id?: string;
  unlock_lock_address?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface UserPayload {
  userId: string;
  email: string;
  walletAddress?: string;
  subscriptionStatus: string;
  creditsRemaining: number;
  type: 'extension_token' | 'api_key';
}

export interface AuthContext extends Context {
  user?: User;
  userPayload?: UserPayload;
}

export interface Env {
  DB: any; // D1Database
  JWT_SECRET: string;
  UNLOCK_API_KEY?: string;
  ENVIRONMENT: string;
  VENICE_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  GENIUS_API_KEY?: string;
}

// Higher-level function to verify any token
export async function verifyToken(
  token: string,
  env: Env
): Promise<UserPayload | null> {
  console.log(`[AUTH] verifyToken: Received token for verification: '${token.substring(0, 30)}...'`);

  const isTestApiKey = token.startsWith('scarlett_test_demo_user');
  const isExtensionToken = token.startsWith('scarlett_') && !isTestApiKey;
  const isApiKey = token.startsWith('sk_live_') || token.startsWith('sk_test_');

  if (isTestApiKey) {
    return verifyTestApiKey(token, env);
  }

  if (isExtensionToken) {
    return verifyExtensionToken(token, env);
  }

  if (isApiKey) {
    return verifyApiKey(token, env);
  }

  console.error('[AUTH] verifyToken: Unknown token format');
  return null;
}

// Verify extension token (scarlett_...)
export async function verifyExtensionToken(token: string, env: Env): Promise<UserPayload | null> {
  if (!token.startsWith('scarlett_') || !env.JWT_SECRET) {
    return null;
  }

  const tokenToVerify = token.replace('scarlett_', '');
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(tokenToVerify, secret);

    if (payload.type !== 'extension_token' || !payload.sub) {
      return null;
    }

    const userId = payload.sub as string;
    const user = await getUserById(userId, env);
    
    if (!user || !user.is_active || !isSubscriptionActive(user)) {
      return null;
    }

    return {
      userId,
      email: payload.email as string,
      walletAddress: payload.walletAddress as string | undefined,
      subscriptionStatus: payload.subscriptionStatus as string,
      creditsRemaining: user.credits_limit - user.credits_used,
      type: 'extension_token',
    };
  } catch (e) {
    console.error(`[AUTH] verifyExtensionToken: Token verification failed:`, e);
    return null;
  }
}

// Verify API key - simplified for now
export async function verifyApiKey(token: string, env: Env): Promise<UserPayload | null> {
  // Return null for now - implement when needed
  return null;
}

// Verify test API key
export async function verifyTestApiKey(token: string, env: Env): Promise<UserPayload | null> {
  if (token.startsWith('scarlett_test_demo_user')) {
    const userIdentifier = token.replace('scarlett_test_demo_user_', '');
    const testUserId = `test_${userIdentifier}`;

    try {
      let user = await getUserById(testUserId, env);
      if (!user) {
        // Create test user if doesn't exist
        await createTestUser('0x0000000000000000000000000000000000000000', token, env);
        user = await getUserById(testUserId, env);
      }

      if (!user) return null;

      return {
        userId: user.id,
        email: user.email,
        walletAddress: user.wallet_address,
        subscriptionStatus: user.subscription_status,
        creditsRemaining: user.credits_limit - user.credits_used,
        type: 'extension_token',
      };
    } catch (error) {
      console.error('[AUTH] verifyTestApiKey: Error handling test token:', error);
      return null;
    }
  }

  return null;
}

// Database helper functions - simplified to not require database for now
export async function getUserById(userId: string, env: Env): Promise<User | null> {
  try {
    if (!env.DB) {
      // Return mock user when no database is available
      return {
        id: userId,
        email: 'test@example.com',
        subscription_status: 'trial',
        credits_used: 0,
        credits_limit: 100,
        credits_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      };
    }

    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ? AND is_active = true'
    ).bind(userId).first();

    return result as User | null;
  } catch (error) {
    console.error('[AUTH] Error fetching user by ID:', error);
    // Return mock user on database error for development
    return {
      id: userId,
      email: 'test@example.com',
      subscription_status: 'trial',
      credits_used: 0,
      credits_limit: 100,
      credits_reset_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };
  }
}

export async function createTestUser(walletAddress: string, apiKey: string, env: Env): Promise<any> {
  if (!env.DB) {
    return true; // Skip database operations when no DB available
  }

  try {
    const userIdentifier = apiKey.replace('scarlett_test_demo_user_', '');
    const testUserId = `test_${userIdentifier}`;
    const testEmail = `test+${Date.now()}@scarlett.dev`;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, wallet_address, display_name,
        created_at, updated_at, subscription_status, trial_expires_at,
        credits_used, credits_limit, credits_reset_at, is_active
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 'trial', datetime('now', '+1 year'), 0, 10000, datetime('now', '+1 month'), true)
    `).bind(testUserId, testEmail, walletAddress.toLowerCase(), 'Test User').run();

    return true;
  } catch (e) {
    console.error('[AUTH] createTestUser: Error during database operation:', e);
    return true; // Don't fail if database isn't available
  }
}

// Check if user subscription is active
export function isSubscriptionActive(user: User): boolean {
  if (user.subscription_status === 'active') {
    if (user.subscription_expires_at) {
      return new Date(user.subscription_expires_at) > new Date();
    }
    return true;
  }

  if (user.subscription_status === 'trial') {
    if (user.trial_expires_at) {
      return new Date(user.trial_expires_at) > new Date();
    }
    return false;
  }

  return false;
}

// Middleware to authenticate requests
export async function authMiddleware(c: AuthContext, next: () => Promise<void>) {
  console.log('[AUTH] 🔍 Authentication attempt:', {
    method: c.req.method,
    url: c.req.url,
    hasAuthHeader: !!c.req.header('Authorization'),
  });

  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] ❌ Missing or invalid authorization header');
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const userPayload = await verifyToken(token, c.env);

  if (!userPayload) {
    console.log('[AUTH] ❌ Token verification failed');
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Get fresh user data from database
  const user = await getUserById(userPayload.userId, c.env);
  if (!user) {
    console.log('[AUTH] ❌ User not found in database');
    return c.json({ error: 'User not found' }, 401);
  }

  // Check if user is active
  if (!user.is_active || user.subscription_status === 'cancelled') {
    console.log('[AUTH] ❌ Account inactive');
    return c.json({ error: 'Account inactive' }, 401);
  }

  console.log('[AUTH] ✅ Authentication successful:', {
    userId: user.id,
    email: user.email,
    subscription_status: user.subscription_status,
  });

  // Attach user to context
  c.user = user;
  c.userPayload = userPayload;

  await next();
}