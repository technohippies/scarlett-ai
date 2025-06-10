import { beforeAll, afterEach, vi } from 'vitest';

// Mock environment
beforeAll(() => {
  // Set up test environment variables
  vi.stubEnv('ENVIRONMENT', 'test');
  vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing-only');
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock fetch for external API calls
global.fetch = vi.fn();

// Mock crypto for Workers environment
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    subtle: {} as SubtleCrypto,
    getRandomValues: (array: any) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  } as Crypto;
}