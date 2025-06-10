import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Env } from './types';

// Middleware
import { 
  createCorsMiddleware, 
  corsHeaders, 
  errorHandler, 
  requestId 
} from './middleware';

// Routes
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import karaokeRoutes from './routes/karaoke.routes';
import songsRoutes from './routes/songs.routes';
import sttRoutes from './routes/stt.routes';
import docsApp from './docs/openapi';

// Create app
const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    requestId?: string;
  };
}>();

// Global middleware
app.use('*', requestId);
app.use('*', logger());
app.use('*', errorHandler);

// CORS middleware - use both library and manual headers for reliability
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  await corsMiddleware(c, next);
});
app.use('*', corsHeaders);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: '🎤 Scarlett Karaoke API',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
  });
});

// OPTIONS requests handled by global CORS middleware

// Mount routes
app.route('/api/health', healthRoutes);
app.route('/auth', authRoutes);
app.route('/api/karaoke', karaokeRoutes);
app.route('/api/songs', songsRoutes);
app.route('/api/speech-to-text', sttRoutes);

// Documentation (only in development)
app.use('/docs/*', async (c, next) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.notFound();
  }
  return await next();
});
app.route('/docs', docsApp);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Endpoint not found',
      path: c.req.path,
    },
    404
  );
});

// Error handler (catches any unhandled errors)
app.onError((err, c) => {
  console.error(`[Error] ${c.req.method} ${c.req.path}:`, err);
  
  // Don't expose internal errors in production
  const message = c.env.ENVIRONMENT === 'production' 
    ? 'Internal server error' 
    : err.message;

  return c.json(
    {
      success: false,
      error: message,
      requestId: c.get('requestId'),
    },
    500
  );
});

export default app;