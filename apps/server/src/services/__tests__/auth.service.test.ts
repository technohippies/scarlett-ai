import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../auth.service';
import { createTestEnv, createTestUser } from '../../test/helpers';
import { AuthenticationError, ValidationError } from '../../types';

describe('AuthService', () => {
  let authService: AuthService;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    authService = new AuthService(env);
  });

  describe('generateExtensionToken', () => {
    it('should generate a valid extension token', async () => {
      const user = createTestUser();
      const token = await authService.generateExtensionToken(user);

      expect(token).toMatch(/^scarlett_[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    it('should include correct payload in token', async () => {
      const user = createTestUser({
        creditsUsed: 20,
        creditsLimit: 100,
      });
      const token = await authService.generateExtensionToken(user);

      // Verify by decoding
      const payload = await authService.verifyToken(token);
      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.creditsRemaining).toBe(80);
      expect(payload.type).toBe('extension_token');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const user = createTestUser();
      const token = await authService.generateExtensionToken(user);
      const payload = await authService.verifyToken(token);

      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe(user.email);
    });

    it('should throw on invalid token', async () => {
      await expect(
        authService.verifyToken('invalid-token')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw on empty token', async () => {
      await expect(
        authService.verifyToken('')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should handle tokens with Bearer prefix', async () => {
      const user = createTestUser();
      const token = await authService.generateExtensionToken(user);
      const payload = await authService.verifyToken(`Bearer ${token}`);

      expect(payload.userId).toBe(user.id);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = createTestUser();
      
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser),
        }),
      } as any);

      const user = await authService.getUserById('test-user-id');
      expect(user).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      const user = await authService.getUserById('non-existent');
      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'new@example.com',
        displayName: 'New User',
      };

      const mockUser = createTestUser(userData);

      let runCalled = false;
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockImplementation(() => {
                runCalled = true;
                return Promise.resolve({ success: true });
              }),
            }),
          } as any;
        }
        // SELECT query for getUserById
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockUser),
          }),
        } as any;
      });

      const user = await authService.createUser(userData);

      expect(runCalled).toBe(true);
      expect(user.email).toBe(userData.email);
      expect(user.displayName).toBe(userData.displayName);
    });
  });

  describe('checkCredits', () => {
    it('should return true when user has enough credits', async () => {
      const user = createTestUser({
        creditsUsed: 20,
        creditsLimit: 100,
      });

      vi.spyOn(authService, 'getUserById').mockResolvedValue(user);

      const hasCredits = await authService.checkCredits('test-user-id', 10);
      expect(hasCredits).toBe(true);
    });

    it('should return false when user has insufficient credits', async () => {
      const user = createTestUser({
        creditsUsed: 95,
        creditsLimit: 100,
      });

      vi.spyOn(authService, 'getUserById').mockResolvedValue(user);

      const hasCredits = await authService.checkCredits('test-user-id', 10);
      expect(hasCredits).toBe(false);
    });

    it('should return false when user not found', async () => {
      vi.spyOn(authService, 'getUserById').mockResolvedValue(null);

      const hasCredits = await authService.checkCredits('non-existent', 1);
      expect(hasCredits).toBe(false);
    });
  });

  describe('useCredits', () => {
    it('should deduct credits when available', async () => {
      const user = createTestUser({
        creditsUsed: 20,
        creditsLimit: 100,
      });

      vi.spyOn(authService, 'getUserById').mockResolvedValue(user);
      
      const runMock = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: runMock,
        }),
      } as any);

      await authService.useCredits('test-user-id', 5);

      expect(runMock).toHaveBeenCalled();
    });

    it('should throw when insufficient credits', async () => {
      const user = createTestUser({
        creditsUsed: 95,
        creditsLimit: 100,
      });

      vi.spyOn(authService, 'getUserById').mockResolvedValue(user);

      await expect(
        authService.useCredits('test-user-id', 10)
      ).rejects.toThrow(ValidationError);
    });
  });
});