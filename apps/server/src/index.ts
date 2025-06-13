import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Env } from './types';

// Middleware
import { 
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
import { exercisesRoutes } from './routes/exercises.routes';
import { practiceRoutes } from './routes/practice.routes';
import { audioProxyRouter } from './routes/audio-proxy.routes';
import { searchRoutes } from './routes/search.routes';
import { userRoutes } from './routes/user.routes';
import { performanceRoutes } from './routes/performance.routes';
import imageRoutes from './routes/images.routes';
import { lyricsRoutes } from './routes/lyrics.routes';
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

// CORS middleware - use only the manual headers implementation
// This avoids conflicts with OPTIONS handling
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
app.route('/api/exercises', exercisesRoutes);
app.route('/api/practice', practiceRoutes);
app.route('/api/audio', audioProxyRouter);
app.route('/api/search', searchRoutes);
app.route('/api/users', userRoutes);
app.route('/api/performances', performanceRoutes);
app.route('/api/images', imageRoutes);
app.route('/api/lyrics', lyricsRoutes);

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