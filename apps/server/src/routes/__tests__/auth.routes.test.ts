import { describe, it, expect, beforeEach, vi } from 'vitest';
import authRoutes from '../auth.routes';
import { 
  createTestEnv, 
  createTestRequest, 
  createTestUser,
  createAuthenticatedRequest 
} from '../../test/helpers';

describe('Auth Routes', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    vi.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      // Mock DB to return null for existing user check
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM users')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null), // No existing user
            }),
          } as any;
        }
        if (query.includes('INSERT INTO users')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        // SELECT for getUserById after creation
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(createTestUser({
              email: 'new@example.com',
              displayName: 'New User',
            })),
          }),
        } as any;
      });

      const request = createTestRequest('POST', '/auth/register', {
        body: {
          email: 'new@example.com',
          displayName: 'New User',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('new@example.com');
      expect(data.token).toMatch(/^scarlett_/);
    });

    it('should reject duplicate email', async () => {
      // Mock DB to return existing user
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'existing-user' }),
        }),
      } as any);

      const request = createTestRequest('POST', '/auth/register', {
        body: {
          email: 'existing@example.com',
          displayName: 'Test User',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should validate email format', async () => {
      const request = createTestRequest('POST', '/auth/register', {
        body: {
          email: 'invalid-email',
          displayName: 'Test User',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with email', async () => {
      const mockUser = createTestUser();
      
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM users')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: mockUser.id }),
            }),
          } as any;
        }
        // SELECT for getUserById
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockUser),
          }),
        } as any;
      });

      const request = createTestRequest('POST', '/auth/login', {
        body: {
          email: 'test@example.com',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(mockUser.email);
      expect(data.token).toMatch(/^scarlett_/);
    });

    it('should login with wallet address', async () => {
      const mockUser = createTestUser();
      
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM users')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: mockUser.id }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockUser),
          }),
        } as any;
      });

      const request = createTestRequest('POST', '/auth/login', {
        body: {
          walletAddress: '0x1234567890123456789012345678901234567890',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      const request = createTestRequest('POST', '/auth/login', {
        body: {
          email: 'nonexistent@example.com',
        },
      });

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid credentials');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = createTestUser();
      
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      } as any);

      const request = await createAuthenticatedRequest(
        'GET',
        '/auth/me',
        mockUser,
        env
      );

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(mockUser.id);
      expect(data.user.email).toBe(mockUser.email);
      expect(data.user.creditsRemaining).toBe(100);
    });

    it('should reject unauthenticated requests', async () => {
      const request = createTestRequest('GET', '/auth/me');

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token for authenticated user', async () => {
      const mockUser = createTestUser();
      
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      } as any);

      const request = await createAuthenticatedRequest(
        'POST',
        '/auth/refresh',
        mockUser,
        env
      );

      const response = await authRoutes.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toMatch(/^scarlett_/);
      expect(data.expiresIn).toBe('7d');
    });
  });
});