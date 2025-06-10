import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  authMiddleware,
  createUser,
  generateExtensionToken,
  getUserByEmail,
  getUserByWallet,
  updateUserSubscription,
  type AuthContext,
  type Env,
} from '../auth';

const app = new Hono<{ Bindings: Env }>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().optional(), // For future password-based auth
  wallet_address: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  wallet_address: z.string().min(42, 'Invalid wallet address'),
  display_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

const verifyUnlockSchema = z.object({
  transaction_hash: z.string(),
  lock_address: z.string(),
  key_id: z.string(),
  user_wallet: z.string(),
});

// POST /auth/register - Register new user
app.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, wallet_address, display_name, avatar_url } =
      c.req.valid('json');

    // Check if user already exists
    const existingUserByEmail = await getUserByEmail(email, c.env);
    if (existingUserByEmail) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    const existingUserByWallet = await getUserByWallet(wallet_address, c.env);
    if (existingUserByWallet) {
      return c.json({ error: 'User with this wallet already exists' }, 400);
    }

    // Create new user
    const user = await createUser(
      {
        email,
        wallet_address,
        display_name,
        avatar_url,
      },
      c.env
    );

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Generate extension token
    const token = await generateExtensionToken(user, c.env);

    return c.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        wallet_address: user.wallet_address,
        display_name: user.display_name,
        subscription_status: user.subscription_status,
        trial_expires_at: user.trial_expires_at,
        credits_remaining: user.credits_limit - user.credits_used,
      },
      token,
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// POST /auth/login - Login user (wallet-based or email-based)
app.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, wallet_address } = c.req.valid('json');

    let user = null;

    if (wallet_address) {
      user = await getUserByWallet(wallet_address, c.env);
    } else if (email) {
      user = await getUserByEmail(email, c.env);
    } else {
      return c.json({ error: 'Email or wallet address required' }, 400);
    }

    if (!user || !user.is_active) {
      return c.json({ error: 'User not found or inactive' }, 401);
    }

    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(user.id)
      .run();

    // Generate extension token
    const token = await generateExtensionToken(user, c.env);

    return c.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        wallet_address: user.wallet_address,
        display_name: user.display_name,
        subscription_status: user.subscription_status,
        trial_expires_at: user.trial_expires_at,
        subscription_expires_at: user.subscription_expires_at,
        credits_remaining: user.credits_limit - user.credits_used,
      },
      token,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// GET /auth/me - Get current user info (requires auth)
app.get('/me', authMiddleware, async (c: AuthContext) => {
  const user = c.user!;

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      subscription_status: user.subscription_status,
      trial_expires_at: user.trial_expires_at,
      subscription_expires_at: user.subscription_expires_at,
      credits_used: user.credits_used,
      credits_limit: user.credits_limit,
      credits_remaining: user.credits_limit - user.credits_used,
      unlock_key_id: user.unlock_key_id,
      unlock_lock_address: user.unlock_lock_address,
      created_at: user.created_at,
      last_login: user.last_login,
    },
  });
});

// POST /auth/verify-unlock - Verify Unlock Protocol purchase
app.post(
  '/verify-unlock',
  zValidator('json', verifyUnlockSchema),
  async (c) => {
    try {
      const { transaction_hash, lock_address, key_id, user_wallet } =
        c.req.valid('json');

      // Find user by wallet
      const user = await getUserByWallet(user_wallet, c.env);
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      // TODO: Implement actual Unlock Protocol verification
      // This would involve calling the Unlock Protocol API to verify the transaction
      // For now, we'll simulate verification
      console.log(`[Auth] Verifying Unlock transaction: ${transaction_hash}`);

      // Simulate verification delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update user subscription (simulate successful verification)
      const subscriptionData = {
        status: 'active' as const,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(), // 30 days
        unlock_key_id: key_id,
        unlock_lock_address: lock_address,
        credits_granted: 1000, // Grant 1000 credits for subscription
      };

      const updateSuccess = await updateUserSubscription(
        user.id,
        subscriptionData,
        c.env
      );
      if (!updateSuccess) {
        return c.json({ error: 'Failed to update subscription' }, 500);
      }

      // Store payment record
      await c.env.DB.prepare(
        `
        INSERT INTO payment_records (
          id, user_id, transaction_hash, lock_address, key_id,
          amount_wei, network_id, subscription_duration_days, credits_granted,
          status, confirmed_at
        ) VALUES (?, ?, ?, ?, ?, '0', 1, 30, 1000, 'confirmed', datetime('now'))
      `
      )
        .bind(
          crypto.randomUUID(),
          user.id,
          transaction_hash,
          lock_address,
          key_id
        )
        .run();

      // Generate new token with updated subscription
      const updatedUser = await getUserByWallet(user_wallet, c.env);
      const token = updatedUser
        ? await generateExtensionToken(updatedUser, c.env)
        : null;

      return c.json({
        success: true,
        message: 'Unlock subscription verified successfully',
        subscription: {
          status: 'active',
          expires_at: subscriptionData.expires_at,
          credits_granted: subscriptionData.credits_granted,
        },
        token,
      });
    } catch (error) {
      console.error('[Auth] Unlock verification error:', error);
      return c.json({ error: 'Verification failed' }, 500);
    }
  }
);

// POST /auth/refresh - Refresh token (requires auth)
app.post('/refresh', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.user!;

    // Generate new token
    const token = await generateExtensionToken(user, c.env);

    return c.json({
      success: true,
      message: 'Token refreshed successfully',
      token,
      user: {
        id: user.id,
        subscription_status: user.subscription_status,
        credits_remaining: user.credits_limit - user.credits_used,
      },
    });
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 500);
  }
});

// GET /auth/subscription - Get subscription details (requires auth)
app.get('/subscription', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.user!;

    // Get recent payment records
    const payments = await c.env.DB.prepare(
      `
      SELECT transaction_hash, amount_wei, token_symbol, network_id,
             subscription_duration_days, credits_granted, status, confirmed_at
      FROM payment_records 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `
    )
      .bind(user.id)
      .all();

    return c.json({
      success: true,
      subscription: {
        status: user.subscription_status,
        expires_at: user.subscription_expires_at,
        trial_expires_at: user.trial_expires_at,
        unlock_key_id: user.unlock_key_id,
        unlock_lock_address: user.unlock_lock_address,
        credits_used: user.credits_used,
        credits_limit: user.credits_limit,
        credits_remaining: user.credits_limit - user.credits_used,
        credits_reset_at: user.credits_reset_at,
      },
      payments: payments.results || [],
    });
  } catch (error) {
    console.error('[Auth] Subscription info error:', error);
    return c.json({ error: 'Failed to get subscription info' }, 500);
  }
});

export default app;
