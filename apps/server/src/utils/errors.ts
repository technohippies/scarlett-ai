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
      error.statusCode
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
  statusCode: number = 500,
  code?: string
) {
  return {
    success: false,
    error: message,
    code,
  };
}