import { Context, Next } from 'hono';
import type { Env, User } from '../types';
import { AuthenticationError } from '../types';
import { AuthService } from '../services/auth.service';

export interface AuthContext extends Context {
  env: Env;
  user?: User;
}

export async function authMiddleware(c: AuthContext, next: Next) {
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
    c.user = user;
    
    await next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

// Optional auth middleware - doesn't fail if no token
export async function optionalAuthMiddleware(c: AuthContext, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const authService = new AuthService(c.env);
      const payload = await authService.verifyToken(token);
      const user = await authService.getUserById(payload.userId);
      
      if (user && user.isActive) {
        c.user = user;
      }
    } catch {
      // Ignore auth errors for optional auth
    }
  }

  await next();
}

// Credits check middleware
export async function requireCredits(amount: number = 1) {
  return async (c: AuthContext, next: Next) => {
    if (!c.user) {
      throw new AuthenticationError();
    }

    const authService = new AuthService(c.env);
    const hasCredits = await authService.checkCredits(c.user.id, amount);
    
    if (!hasCredits) {
      return c.json(
        {
          success: false,
          error: 'Insufficient credits',
          creditsRequired: amount,
          creditsRemaining: Math.max(0, c.user.creditsLimit - c.user.creditsUsed),
        },
        402 // Payment Required
      );
    }

    await next();
  };
}