# Testing Guide for Scarlett API

## Overview

The Scarlett API uses Vitest for testing with support for:
- Unit tests for services and utilities
- Integration tests for API endpoints
- Mocking of external services
- Coverage reporting

## Test Structure

```
src/
├── services/
│   └── __tests__/        # Service unit tests
├── routes/
│   └── __tests__/        # Route unit tests
├── __tests__/            # Integration tests
└── test/
    ├── setup.ts          # Unit test setup
    ├── setup.integration.ts  # Integration test setup
    └── helpers/          # Test utilities
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration

# Run specific test file
npm test auth.service.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Writing Tests

### Unit Tests

Unit tests focus on individual functions and classes in isolation:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../auth.service';
import { createTestEnv, createTestUser } from '../../test/helpers';

describe('AuthService', () => {
  let authService: AuthService;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    authService = new AuthService(env);
  });

  it('should generate a valid token', async () => {
    const user = createTestUser();
    const token = await authService.generateExtensionToken(user);
    
    expect(token).toMatch(/^scarlett_/);
  });
});
```

### Integration Tests

Integration tests verify complete API flows:

```typescript
describe('Karaoke API Flow', () => {
  it('should complete full karaoke session', async () => {
    // 1. Get karaoke data
    const karaokeResponse = await fetch('/api/karaoke/track-123');
    
    // 2. Start session
    const startResponse = await fetch('/api/karaoke/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId: 'track-123' }),
    });
    
    // 3. Grade lines
    // 4. Complete session
  });
});
```

### Mocking External Services

Mock external APIs to avoid real API calls:

```typescript
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock specific response
vi.mocked(fetch).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ transcript: 'Hello world' }),
} as Response);
```

### Database Mocking

The test helpers provide a mock D1 database:

```typescript
const mockDB = createMockDB();

// Mock specific queries
vi.spyOn(mockDB, 'prepare').mockImplementation((query) => {
  if (query.includes('SELECT * FROM users')) {
    return {
      bind: () => ({
        first: async () => mockUser,
      }),
    };
  }
});
```

## Test Helpers

### Creating Test Data

```typescript
// Create test user
const user = createTestUser({
  email: 'custom@example.com',
  creditsUsed: 50,
});

// Create test environment
const env = createTestEnv();

// Create authenticated request
const request = await createAuthenticatedRequest(
  'POST',
  '/api/karaoke/start',
  user,
  env,
  { body: { trackId: 'test-123' } }
);
```

### Custom Assertions

```typescript
// Check API response format
expect(response).toMatchObject({
  success: true,
  data: expect.any(Array),
  pagination: {
    page: 1,
    limit: 20,
    total: expect.any(Number),
    hasMore: expect.any(Boolean),
  },
});
```

## Coverage

Generate and view coverage reports:

```bash
# Generate coverage
npm run test:coverage

# View HTML report
open coverage/index.html
```

Target coverage goals:
- Statements: 80%+
- Branches: 70%+
- Functions: 80%+
- Lines: 80%+

## Best Practices

1. **Test Organization**
   - Group related tests with `describe` blocks
   - Use clear, descriptive test names
   - Follow AAA pattern: Arrange, Act, Assert

2. **Mock Management**
   - Reset mocks between tests
   - Use `vi.clearAllMocks()` in `beforeEach`
   - Mock at the appropriate level

3. **Async Testing**
   - Always await async operations
   - Use `expect.assertions()` for async tests
   - Handle both success and error cases

4. **Test Data**
   - Use factories for consistent test data
   - Avoid hardcoding values
   - Clean up test data after tests

5. **Performance**
   - Keep unit tests fast (<100ms)
   - Use integration tests sparingly
   - Mock heavy operations

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

GitHub Actions workflow:
```yaml
- name: Run tests
  run: |
    npm ci
    npm run test:coverage
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Debugging Tests

```bash
# Run with debugging
npm test -- --inspect-brk

# Run single test with logging
npm test -- --reporter=verbose auth.service.test.ts

# Show test execution time
npm test -- --reporter=default --reporter=time
```

## Common Issues

1. **Timeout Errors**
   - Increase timeout: `test('name', async () => {}, 10000)`
   - Check for missing `await` statements

2. **Module Resolution**
   - Ensure TypeScript paths are configured
   - Check vitest config aliases

3. **Environment Variables**
   - Use `vi.stubEnv()` for test env vars
   - Don't rely on `.env` files in tests

4. **Flaky Tests**
   - Avoid time-dependent assertions
   - Mock `Date.now()` when needed
   - Use stable test data