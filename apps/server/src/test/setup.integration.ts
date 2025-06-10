import { beforeAll, afterAll, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

let worker: UnstableDevWorker;

beforeAll(async () => {
  // Start the worker
  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    local: true,
    persist: false,
  });
});

afterAll(async () => {
  // Stop the worker
  if (worker) {
    await worker.stop();
  }
});

beforeEach(async () => {
  // Reset database state between tests
  // This would ideally run migrations or reset test data
});