import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import type { Env, User, JWTPayload } from '../types';
import { AuthenticationError, ValidationError } from '../types';

export class AuthService {
  constructor(private env: Env) {}

  async generateExtensionToken(user: User): Promise<string> {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);

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

  async generateApiKey(user: User): Promise<string> {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);

    const jwt = await new SignJWT({
      userId: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      type: 'api_key',
    } as Partial<JWTPayload>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1y')
      .setSubject(user.id)
      .sign(secret);

    return `sk_live_${jwt}`;
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Remove prefix if present
    const cleanToken = token.replace(/^(scarlett_|sk_live_|Bearer\s+)/i, '');

    try {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const { payload } = await jwtVerify(cleanToken, secret, {
        algorithms: ['HS256'],
      });

      return payload as unknown as JWTPayload;
    } catch (error) {
      console.error('[AUTH] Token verification failed:', error);
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await this.env.DB.prepare(
      `SELECT 
        id, email, wallet_address as walletAddress, display_name as displayName,
        avatar_url as avatarUrl, subscription_status as subscriptionStatus,
        subscription_expires_at as subscriptionExpiresAt,
        trial_expires_at as trialExpiresAt, credits_used as creditsUsed,
        credits_limit as creditsLimit, credits_reset_at as creditsResetAt,
        unlock_key_id as unlockKeyId, unlock_lock_address as unlockLockAddress,
        created_at as createdAt, updated_at as updatedAt, last_login as lastLogin,
        is_active as isActive
      FROM users WHERE id = ? AND is_active = true`
    )
      .bind(userId)
      .first();

    return result as User | null;
  }

  async createUser(data: {
    email: string;
    walletAddress?: string;
    displayName?: string;
  }): Promise<User> {
    const userId = nanoid();
    const now = new Date().toISOString();

    await this.env.DB.prepare(
      `INSERT INTO users (
        id, email, wallet_address, display_name, created_at, updated_at,
        trial_expires_at, credits_reset_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 days'), datetime('now', '+1 month'))`
    )
      .bind(userId, data.email, data.walletAddress, data.displayName, now, now)
      .run();

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(userId)
      .run();
  }

  async checkCredits(userId: string, required: number = 1): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const remaining = user.creditsLimit - user.creditsUsed;
    return remaining >= required;
  }

  async useCredits(userId: string, amount: number = 1): Promise<void> {
    const hasCredits = await this.checkCredits(userId, amount);
    if (!hasCredits) {
      throw new ValidationError('Insufficient credits');
    }

    await this.env.DB.prepare(
      'UPDATE users SET credits_used = credits_used + ? WHERE id = ?'
    )
      .bind(amount, userId)
      .run();
  }
}