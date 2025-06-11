import { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { getConfig } from '../config';

export function createCorsMiddleware(env: Env) {
  const config = getConfig(env);

  return cors({
    origin: config.cors.origins,
    allowMethods: config.cors.methods,
    allowHeaders: config.cors.headers,
    credentials: config.cors.credentials,
    maxAge: 86400, // 24 hours
  });
}

// Manual CORS headers as fallback
export async function corsHeaders(c: Context, next: Next): Promise<void | Response> {
  const origin = c.req.header('Origin');
  const env = c.env as Env;
  const config = getConfig(env);

  // Check if origin is allowed
  const isAllowed = !origin || config.cors.origins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  });

  if (isAllowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    c.header('Access-Control-Allow-Origin', config.cors.origins[0]);
  }
  
  // Debug logging
  console.log('[CORS] Request:', {
    method: c.req.method,
    path: c.req.path,
    origin,
    isAllowed,
    headers: c.req.header()
  });

  c.header('Access-Control-Allow-Methods', config.cors.methods.join(', '));
  c.header('Access-Control-Allow-Headers', config.cors.headers.join(', '));
  c.header('Access-Control-Max-Age', '86400');
  
  if (config.cors.credentials) {
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  if (c.req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS request');
    // Return a response with all the headers already set
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin && isAllowed ? origin : config.cors.origins[0],
        'Access-Control-Allow-Methods': config.cors.methods.join(', '),
        'Access-Control-Allow-Headers': config.cors.headers.join(', '),
        'Access-Control-Max-Age': '86400',
        ...(config.cors.credentials && { 'Access-Control-Allow-Credentials': 'true' })
      }
    });
  }

  await next();
}