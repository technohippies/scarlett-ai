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

// Generate JWT token for extension
export async function generateExtensionToken(
  user: User,
  env: Env
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const jwt = await new SignJWT({
    userId: user.id,
    email: user.email,
    walletAddress: user.wallet_address,
    subscriptionStatus: user.subscription_status,
    creditsRemaining: Math.max(0, user.credits_limit - user.credits_used),
    type: 'extension_token',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Extension tokens valid for 7 days
    .setSubject(user.id)
    .sign(secret);

  return `scarlett_${jwt}`;
}

// Generate API key for server-to-server (future use)
export async function generateApiKey(user: User, env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const jwt = await new SignJWT({
    userId: user.id,
    email: user.email,
    walletAddress: user.wallet_address,
    type: 'api_key',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y') // API keys valid for 1 year
    .setSubject(user.id)
    .sign(secret);

  return `sk_live_${jwt}`;
}

// Higher-level function to verify any token
export async function verifyToken(
  token: string,
  env: Env
): Promise<UserPayload | null> {
  console.log(
    `[AUTH] verifyToken: Received token for verification: '${token.substring(0, 30)}...'`
  );

  const isTestApiKey = token.startsWith('scarlett_test_demo_user');
  const isExtensionToken = token.startsWith('scarlett_') && !isTestApiKey;
  const isApiKey = token.startsWith('sk_live_') || token.startsWith('sk_test_');

  console.log(
    `[AUTH] verifyToken: Test API key? ${isTestApiKey}, Extension token? ${isExtensionToken}, API key? ${isApiKey}`
  );

  if (isTestApiKey) {
    console.log('[AUTH] verifyToken: Routing to verifyTestApiKey.');
    return verifyTestApiKey(token, env);
  }

  if (isExtensionToken) {
    console.log('[AUTH] verifyToken: Routing to verifyExtensionToken.');
    return verifyExtensionToken(token, env);
  }

  if (isApiKey) {
    console.log('[AUTH] verifyToken: Routing to verifyApiKey.');
    return verifyApiKey(token, env);
  }

  console.error('[AUTH] verifyToken: Unknown token format');
  return null;
}

// Verify extension token (scarlett_...)
export async function verifyExtensionToken(
  token: string,
  env: Env
): Promise<UserPayload | null> {
  console.log(
    `[AUTH] verifyExtensionToken: Verifying extension token: ${token.substring(0, 30)}...`
  );

  if (!token.startsWith('scarlett_')) {
    console.error(
      '[AUTH] verifyExtensionToken: Token does not start with scarlett_'
    );
    return null;
  }

  if (!env.JWT_SECRET) {
    console.error(
      '[AUTH] verifyExtensionToken: JWT_SECRET is not defined in environment'
    );
    return null;
  }

  const tokenToVerify = token.replace('scarlett_', '');
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(tokenToVerify, secret);

    if (payload.type !== 'extension_token' || !payload.sub) {
      console.error(
        '[AUTH] verifyExtensionToken: Invalid payload type or missing sub',
        payload
      );
      return null;
    }

    const userId = payload.sub as string;
    console.log(
      `[AUTH] verifyExtensionToken: JWT verified successfully for userId: ${userId}`
    );

    // Get user from database to ensure they still exist and are active
    const user = await getUserById(userId, env);
    if (!user || !user.is_active) {
      console.error(
        `[AUTH] verifyExtensionToken: User not found or inactive: ${userId}`
      );
      return null;
    }

    // Check if subscription is still active
    if (!isSubscriptionActive(user)) {
      console.error(
        `[AUTH] verifyExtensionToken: User subscription inactive: ${userId}`
      );
      return null;
    }

    return {
      userId,
      email: payload.email as string,
      walletAddress: payload.walletAddress as string | undefined,
      subscriptionStatus: payload.subscriptionStatus as string,
      creditsRemaining: user.credits_limit - user.credits_used, // Get fresh count from DB
      type: 'extension_token',
    };
  } catch (e) {
    if (e instanceof Error) {
      console.error(
        `[AUTH] verifyExtensionToken: Token verification failed. Error: ${e.message}`
      );
    } else {
      console.error(
        `[AUTH] verifyExtensionToken: Token verification failed. Unknown error:`,
        e
      );
    }
    return null;
  }
}

// Verify API key (sk_live_... or sk_test_...)
export async function verifyApiKey(
  token: string,
  env: Env
): Promise<UserPayload | null> {
  console.log(
    `[AUTH] verifyApiKey: Verifying API key: ${token.substring(0, 30)}...`
  );

  const isTestKey = token.startsWith('sk_test_');
  console.log(`[AUTH] verifyApiKey: Is test key? ${isTestKey}`);

  if (isTestKey) {
    return verifyTestApiKey(token, env);
  }

  // Logic for sk_live_ keys
  if (!env.JWT_SECRET) {
    console.error(
      '[AUTH] verifyApiKey: JWT_SECRET is not defined in environment'
    );
    return null;
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const tokenToVerify = token.replace('sk_live_', '');

  try {
    const { payload } = await jwtVerify(tokenToVerify, secret);

    if (payload.type !== 'api_key' || !payload.sub) {
      console.error(
        '[AUTH] verifyApiKey: Invalid payload type or missing sub',
        payload
      );
      return null;
    }

    const userId = payload.sub as string;
    console.log(
      `[AUTH] verifyApiKey: JWT verified successfully for userId: ${userId}`
    );

    // Get user from database
    const user = await getUserById(userId, env);
    if (!user || !user.is_active) {
      console.error(
        `[AUTH] verifyApiKey: User not found or inactive: ${userId}`
      );
      return null;
    }

    return {
      userId,
      email: payload.email as string,
      walletAddress: payload.walletAddress as string | undefined,
      subscriptionStatus: user.subscription_status,
      creditsRemaining: user.credits_limit - user.credits_used,
      type: 'api_key',
    };
  } catch (e) {
    if (e instanceof Error) {
      console.error(
        `[AUTH] verifyApiKey: API key verification failed. Error: ${e.message}`
      );
    } else {
      console.error(
        `[AUTH] verifyApiKey: API key verification failed. Unknown error:`,
        e
      );
    }
    return null;
  }
}

// Verify test API key (sk_test_... or scarlett_test_demo_user)
export async function verifyTestApiKey(
  token: string,
  env: Env
): Promise<UserPayload | null> {
  console.log(
    `[AUTH] verifyTestApiKey: Verifying test key: ${token.substring(0, 30)}...`
  );

  // Handle scarlett_test_demo_user tokens
  if (token.startsWith('scarlett_test_demo_user')) {
    console.log(
      '[AUTH] verifyTestApiKey: Handling scarlett_test_demo_user token'
    );

    // Extract user identifier from token
    const userIdentifier = token.replace('scarlett_test_demo_user_', '');
    const testUserId = `test_${userIdentifier}`;

    console.log(`[AUTH] verifyTestApiKey: Test user ID: ${testUserId}`);

    try {
      // Check if test user exists in database
      let user = await getUserById(testUserId, env);

      if (!user) {
        console.log(
          '[AUTH] verifyTestApiKey: Test user not found, creating...'
        );
        // Create test user if doesn't exist
        await createTestUser(
          '0x0000000000000000000000000000000000000000',
          token,
          env
        );
        user = await getUserById(testUserId, env);
      }

      if (!user) {
        console.error(
          '[AUTH] verifyTestApiKey: Failed to create or retrieve test user'
        );
        return null;
      }

      console.log('[AUTH] verifyTestApiKey: Test user verified successfully:', {
        userId: user.id,
        email: user.email,
        subscription_status: user.subscription_status,
      });

      return {
        userId: user.id,
        email: user.email,
        walletAddress: user.wallet_address,
        subscriptionStatus: user.subscription_status,
        creditsRemaining: user.credits_limit - user.credits_used,
        type: 'extension_token',
      };
    } catch (error) {
      console.error(
        '[AUTH] verifyTestApiKey: Error handling test token:',
        error
      );
      return null;
    }
  }

  if (!token.startsWith('sk_test_')) {
    console.error(
      '[AUTH] verifyTestApiKey: Token does not start with sk_test_ or scarlett_test_demo_user'
    );
    return null;
  }

  if (!env.JWT_SECRET) {
    console.error(
      '[AUTH] verifyTestApiKey: JWT_SECRET is not defined in environment'
    );
    return null;
  }

  const tokenToVerify = token.replace('sk_test_', '');
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(tokenToVerify, secret);

    if (payload.type !== 'api_key' || !payload.sub) {
      console.error(
        '[AUTH] verifyTestApiKey: Invalid payload type or missing sub',
        payload
      );
      return null;
    }

    const userId = payload.sub as string;
    console.log(
      `[AUTH] verifyTestApiKey: JWT verified successfully for userId: ${userId}`
    );

    // For test keys, create/get test user
    const testWalletAddress = '0xB0dD2a6FAB0180C8b2fc4f144273Cc693d7896Ed';

    try {
      let existingUser = await getUserByApiKey(token, env);
      if (!existingUser) {
        console.log(
          `[AUTH] verifyTestApiKey: Creating test user for ${token.substring(0, 15)}...`
        );
        await createTestUser(testWalletAddress, token, env);
        existingUser = await getUserByApiKey(token, env);

        if (!existingUser) {
          console.error(`[AUTH] verifyTestApiKey: Failed to create test user`);
          return null;
        }
      }

      return {
        userId,
        email: payload.email as string,
        walletAddress: testWalletAddress,
        subscriptionStatus: 'trial',
        creditsRemaining: 10000, // Test users get lots of credits
        type: 'api_key',
      };
    } catch (dbError) {
      console.error(
        '[AUTH] verifyTestApiKey: Database operation failed:',
        dbError
      );
      return null;
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error(
        `[AUTH] verifyTestApiKey: Test API key verification failed. Error: ${e.message}`
      );
    } else {
      console.error(
        `[AUTH] verifyTestApiKey: Test API key verification failed. Unknown error:`,
        e
      );
    }
    return null;
  }
}

// Database helper functions
export async function getUserById(
  userId: string,
  env: Env
): Promise<User | null> {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ? AND is_active = true'
    )
      .bind(userId)
      .first();

    return result as User | null;
  } catch (error) {
    console.error('[AUTH] Error fetching user by ID:', error);
    return null;
  }
}

export async function getUserByEmail(
  email: string,
  env: Env
): Promise<User | null> {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = true'
    )
      .bind(email)
      .first();

    return result as User | null;
  } catch (error) {
    console.error('[AUTH] Error fetching user by email:', error);
    return null;
  }
}

export async function getUserByWallet(
  walletAddress: string,
  env: Env
): Promise<User | null> {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE wallet_address = ? AND is_active = true'
    )
      .bind(walletAddress.toLowerCase())
      .first();

    return result as User | null;
  } catch (error) {
    console.error('[AUTH] Error fetching user by wallet:', error);
    return null;
  }
}

export async function getUserByApiKey(
  apiKey: string,
  env: Env
): Promise<User | null> {
  try {
    // For test keys, we store them in a separate test_users table or use a different approach
    // This is a simplified version - you might want to create a separate table for test users
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ? AND is_active = true'
    )
      .bind(`test_${apiKey.substring(0, 20)}`)
      .first();

    return result as User | null;
  } catch (error) {
    console.error('[AUTH] Error fetching user by API key:', error);
    return null;
  }
}

export async function createUser(
  userData: {
    email: string;
    wallet_address?: string;
    display_name?: string;
    avatar_url?: string;
  },
  env: Env
): Promise<User | null> {
  try {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO users (
        id, email, wallet_address, display_name, avatar_url,
        created_at, updated_at, subscription_status, trial_expires_at,
        credits_used, credits_limit, credits_reset_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', datetime('now', '+7 days'), 0, 100, datetime('now', '+1 month'), true)
    `
    )
      .bind(
        userId,
        userData.email,
        userData.wallet_address?.toLowerCase() || null,
        userData.display_name || null,
        userData.avatar_url || null,
        now,
        now
      )
      .run();

    // Create user progress record
    await env.DB.prepare(
      `
      INSERT INTO user_progress (id, user_id) VALUES (?, ?)
    `
    )
      .bind(crypto.randomUUID(), userId)
      .run();

    return await getUserById(userId, env);
  } catch (error) {
    console.error('[AUTH] Error creating user:', error);
    return null;
  }
}

export async function createTestUser(
  walletAddress: string,
  apiKey: string,
  env: Env
): Promise<any> {
  console.log(
    `[AUTH] createTestUser: Creating test user. Wallet: ${walletAddress}, API Key: ${apiKey.substring(0, 15)}...`
  );

  try {
    // Extract user identifier consistently with verifyTestApiKey
    const userIdentifier = apiKey.replace('scarlett_test_demo_user_', '');
    const testUserId = `test_${userIdentifier}`;
    const testEmail = `test+${Date.now()}@scarlett.dev`;

    // Create or replace test user
    await env.DB.prepare(
      `
      INSERT OR REPLACE INTO users (
        id, email, wallet_address, display_name,
        created_at, updated_at, subscription_status, trial_expires_at,
        credits_used, credits_limit, credits_reset_at, is_active
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 'trial', datetime('now', '+1 year'), 0, 10000, datetime('now', '+1 month'), true)
    `
    )
      .bind(testUserId, testEmail, walletAddress.toLowerCase(), 'Test User')
      .run();

    // Create user progress record
    await env.DB.prepare(
      `
      INSERT OR REPLACE INTO user_progress (id, user_id) VALUES (?, ?)
    `
    )
      .bind(`progress_${testUserId}`, testUserId)
      .run();

    console.log(`[AUTH] createTestUser: Test user created successfully`);
    return true;
  } catch (e) {
    console.error('[AUTH] createTestUser: Error during database operation:', e);
    throw e;
  }
}

export async function updateUserSubscription(
  userId: string,
  subscriptionData: {
    status: 'active' | 'expired' | 'cancelled';
    expires_at?: string;
    unlock_key_id?: string;
    unlock_lock_address?: string;
    credits_granted?: number;
  },
  env: Env
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    let updateQuery = `
      UPDATE users SET 
        subscription_status = ?,
        subscription_expires_at = ?,
        unlock_verified_at = ?,
        updated_at = ?
    `;
    const params = [
      subscriptionData.status,
      subscriptionData.expires_at || null,
      subscriptionData.status === 'active' ? now : null,
      now,
    ];

    if (subscriptionData.unlock_key_id) {
      updateQuery += ', unlock_key_id = ?';
      params.push(subscriptionData.unlock_key_id);
    }

    if (subscriptionData.unlock_lock_address) {
      updateQuery += ', unlock_lock_address = ?';
      params.push(subscriptionData.unlock_lock_address);
    }

    if (subscriptionData.credits_granted) {
      updateQuery +=
        ', credits_limit = credits_limit + ?, credits_reset_at = datetime("now", "+1 month")';
      params.push(subscriptionData.credits_granted.toString());
    }

    updateQuery += ' WHERE id = ?';
    params.push(userId);

    await env.DB.prepare(updateQuery)
      .bind(...params)
      .run();
    return true;
  } catch (error) {
    console.error('[AUTH] Error updating user subscription:', error);
    return false;
  }
}

export async function consumeCredits(
  userId: string,
  credits: number = 1,
  env: Env
): Promise<boolean> {
  try {
    const user = await getUserById(userId, env);

    if (!user) return false;

    // Check if user has enough credits
    const remainingCredits = user.credits_limit - user.credits_used;
    if (remainingCredits < credits) {
      return false;
    }

    // Update credits used
    await env.DB.prepare(
      'UPDATE users SET credits_used = credits_used + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(credits, userId)
      .run();

    return true;
  } catch (error) {
    console.error('[AUTH] Error consuming credits:', error);
    return false;
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
export async function authMiddleware(
  c: AuthContext,
  next: () => Promise<void>
) {
  console.log('[AUTH] 🔍 Authentication attempt:', {
    method: c.req.method,
    url: c.req.url,
    hasAuthHeader: !!c.req.header('Authorization'),
  });

  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] ❌ Missing or invalid authorization header:', {
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING',
      startsWith: authHeader?.startsWith('Bearer ') || false,
    });
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  console.log('[AUTH] 🔍 Verifying token:', {
    tokenLength: token.length,
    tokenStart: token.substring(0, 20),
    tokenType: token.startsWith('scarlett_') ? 'api_key' : 'jwt',
  });

  const userPayload = await verifyToken(token, c.env);

  if (!userPayload) {
    console.log('[AUTH] ❌ Token verification failed:', {
      tokenStart: token.substring(0, 20),
      tokenLength: token.length,
    });
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  console.log('[AUTH] ✅ Token verified successfully:', {
    userId: userPayload.userId,
    email: userPayload.email,
    type: userPayload.type,
    creditsRemaining: userPayload.creditsRemaining,
  });

  // Get fresh user data from database
  const user = await getUserById(userPayload.userId, c.env);
  if (!user) {
    console.log('[AUTH] ❌ User not found in database:', {
      userId: userPayload.userId,
      email: userPayload.email,
    });
    return c.json({ error: 'User not found' }, 401);
  }

  // Check if user is active
  if (!user.is_active || user.subscription_status === 'cancelled') {
    console.log('[AUTH] ❌ Account inactive:', {
      userId: user.id,
      is_active: user.is_active,
      subscription_status: user.subscription_status,
    });
    return c.json({ error: 'Account inactive' }, 401);
  }

  console.log('[AUTH] ✅ Authentication successful:', {
    userId: user.id,
    email: user.email,
    subscription_status: user.subscription_status,
    credits_remaining: user.credits_limit - user.credits_used,
  });

  // Attach user to context
  c.user = user;
  c.userPayload = userPayload;

  await next();
}

// Optional middleware (allows both authenticated and anonymous access)
export async function optionalAuthMiddleware(
  c: AuthContext,
  next: () => Promise<void>
) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userPayload = await verifyToken(token, c.env);

    if (userPayload) {
      const user = await getUserById(userPayload.userId, c.env);
      if (user && user.is_active) {
        c.user = user;
        c.userPayload = userPayload;
      }
    }
  }

  await next();
}
