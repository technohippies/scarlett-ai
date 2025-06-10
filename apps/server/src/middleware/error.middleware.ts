import { Context, Next } from 'hono';
import { handleError } from '../utils/errors';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    return handleError(error, c);
  }
}

// Request ID middleware for tracing
export async function requestId(c: Context, next: Next) {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
}