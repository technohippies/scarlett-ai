import { Context } from 'hono';
import { ApiError } from '../types';

export function handleError(error: unknown, c: Context) {
  console.error('[ERROR]', error);

  if (error instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      // @ts-expect-error - Hono type issue with status codes
      error.statusCode || 500
    );
  }

  if (error instanceof Error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }

  return c.json(
    {
      success: false,
      error: 'An unexpected error occurred',
    },
    500
  );
}

export function createErrorResponse(
  message: string,
  _statusCode: number = 500,
  code?: string
) {
  return {
    success: false,
    error: message,
    code,
  };
}