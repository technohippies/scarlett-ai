import type { JWTPayload } from '@scarlett/core';

export function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) return null;
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload) return true;

  // Check if token has exp claim
  if ('exp' in payload) {
    const exp = (payload as any).exp;
    return Date.now() >= exp * 1000;
  }

  return false;
}