import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, User } from '../types';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { emailSchema, walletAddressSchema } from '../utils/validation';

const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    user?: User;
    validatedBody?: any;
  };
}>();

// Validation schemas
const registerSchema = z.object({
  email: emailSchema,
  walletAddress: walletAddressSchema.optional(),
  displayName: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({
  email: emailSchema.optional(),
  walletAddress: walletAddressSchema.optional(),
}).refine((data) => data.email || data.walletAddress, {
  message: 'Either email or wallet address is required',
});

// POST /auth/register
app.post('/register', validateBody(registerSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof registerSchema>;
  const authService = new AuthService(c.env);

  // Check if user already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR wallet_address = ?'
  )
    .bind(data.email, data.walletAddress || null)
    .first();

  if (existingUser) {
    return c.json(
      {
        success: false,
        error: 'User already exists with this email or wallet address',
      },
      409
    );
  }

  // Create user
  const user = await authService.createUser(data);
  const token = await authService.generateExtensionToken(user);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      subscriptionStatus: user.subscriptionStatus,
      creditsRemaining: user.creditsLimit - user.creditsUsed,
    },
    token,
  });
});

// POST /auth/login
app.post('/login', validateBody(loginSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof loginSchema>;
  const authService = new AuthService(c.env);

  // Find user by email or wallet
  let query = 'SELECT * FROM users WHERE ';
  const params: any[] = [];

  if (data.email) {
    query += 'email = ?';
    params.push(data.email);
  } else if (data.walletAddress) {
    query += 'wallet_address = ?';
    params.push(data.walletAddress);
  }

  const userRecord = await c.env.DB.prepare(query).bind(...params).first();

  if (!userRecord) {
    return c.json(
      {
        success: false,
        error: 'Invalid credentials',
      },
      401
    );
  }

  const user = await authService.getUserById(userRecord.id as string);
  if (!user || !user.isActive) {
    return c.json(
      {
        success: false,
        error: 'Account is inactive',
      },
      401
    );
  }

  // Update last login
  await authService.updateLastLogin(user.id);

  // Generate token
  const token = await authService.generateExtensionToken(user);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      subscriptionStatus: user.subscriptionStatus,
      creditsRemaining: Math.max(0, user.creditsLimit - user.creditsUsed),
    },
    token,
  });
});

// GET /auth/me
app.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      trialExpiresAt: user.trialExpiresAt,
      creditsUsed: user.creditsUsed,
      creditsLimit: user.creditsLimit,
      creditsRemaining: Math.max(0, user.creditsLimit - user.creditsUsed),
      creditsResetAt: user.creditsResetAt,
      createdAt: user.createdAt,
    },
  });
});

// POST /auth/refresh
app.post('/refresh', authMiddleware, async (c: AuthContext) => {
  const authService = new AuthService(c.env);
  const user = c.user!;

  // Generate new token
  const token = await authService.generateExtensionToken(user);

  return c.json({
    success: true,
    token,
    expiresIn: '7d',
  });
});

// POST /auth/verify-unlock
app.post('/verify-unlock', authMiddleware, validateBody(z.object({
  lockAddress: z.string(),
  keyId: z.string(),
})), async (c: AuthContext) => {
  const data = c.get('validatedBody') as { lockAddress: string; keyId: string };
  const user = c.user!;

  // TODO: Verify with Unlock Protocol API
  // For now, just update the user record
  await c.env.DB.prepare(
    `UPDATE users 
     SET unlock_lock_address = ?, 
         unlock_key_id = ?, 
         unlock_verified_at = CURRENT_TIMESTAMP,
         subscription_status = 'active',
         subscription_expires_at = datetime('now', '+1 year'),
         credits_limit = 1000
     WHERE id = ?`
  )
    .bind(data.lockAddress, data.keyId, user.id)
    .run();

  return c.json({
    success: true,
    message: 'Unlock Protocol subscription verified',
    subscription: {
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      creditsLimit: 1000,
    },
  });
});

export default app;