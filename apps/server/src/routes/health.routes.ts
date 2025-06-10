import { Hono } from 'hono';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/health - Health check endpoint
app.get('/', async (c) => {
  // Check database connectivity
  let dbStatus = 'unknown';
  try {
    if (c.env.DB) {
      const result = await c.env.DB.prepare('SELECT 1 as healthy').first();
      dbStatus = result ? 'healthy' : 'unhealthy';
    } else {
      dbStatus = 'not configured';
    }
  } catch (error) {
    dbStatus = 'error';
    console.error('[Health] Database check failed:', error);
  }

  return c.json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    services: {
      database: dbStatus,
      genius: c.env.GENIUS_API_KEY ? 'configured' : 'not configured',
      elevenlabs: c.env.ELEVENLABS_API_KEY ? 'configured' : 'not configured',
      deepgram: c.env.DEEPGRAM_API_KEY ? 'configured' : 'not configured',
      venice: c.env.VENICE_API_KEY ? 'configured' : 'not configured',
    },
  });
});

// GET / - Root endpoint
app.get('/info', async (c) => {
  return c.json({
    name: 'Scarlett Karaoke API',
    version: '1.0.0',
    description: 'AI-powered karaoke coaching platform',
    environment: c.env.ENVIRONMENT,
    endpoints: {
      health: '/api/health',
      auth: '/auth/*',
      karaoke: '/api/karaoke/*',
      songs: '/api/songs/*',
      tutor: '/api/tutor/*',
    },
  });
});

export default app;