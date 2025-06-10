import { Context, Next } from 'hono';
import type { Env, User } from '../types';
import { AuthenticationError } from '../types';
import { AuthService } from '../services/auth.service';

export type AuthContext = Context<{
  Bindings: Env;
  Variables: {
    user: User;
  };
}>;

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user?: User } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    throw new AuthenticationError('No authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new AuthenticationError('Invalid authorization format');
  }

  try {
    const authService = new AuthService(c.env);
    const payload = await authService.verifyToken(token);
    
    // Get full user details
    const user = await authService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Update last login
    await authService.updateLastLogin(user.id);

    // Attach user to context
    c.set('user', user);
    
    await next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

// Optional auth middleware - doesn't fail if no token
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env; Variables: { user?: User } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const authService = new AuthService(c.env);
      const payload = await authService.verifyToken(token);
      const user = await authService.getUserById(payload.userId);
      
      if (user && user.isActive) {
        c.set('user', user);
      }
    } catch {
      // Ignore auth errors for optional auth
    }
  }

  await next();
}

// Credits check middleware
export function requireCredits(amount: number = 1) {
  return async (c: Context<{ Bindings: Env; Variables: { user: User } }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new AuthenticationError();
    }

    const authService = new AuthService(c.env);
    const hasCredits = await authService.checkCredits(user.id, amount);
    
    if (!hasCredits) {
      return c.json(
        {
          success: false,
          error: 'Insufficient credits',
          creditsRequired: amount,
          creditsRemaining: Math.max(0, user.creditsLimit - user.creditsUsed),
        },
        402 // Payment Required
      );
    }

    return await next();
  };
}