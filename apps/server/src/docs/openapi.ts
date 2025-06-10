import { apiReference } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import type { Env } from '../types';

const docsApp = new Hono<{ Bindings: Env }>();

// Serve OpenAPI spec
docsApp.get('/openapi.json', async (c) => {
  // For now, return a basic spec. In production, this would be generated
  return c.json({
    openapi: '3.0.0',
    info: {
      title: 'Scarlett Karaoke API',
      description: 'AI-powered karaoke coaching platform API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:8787',
        description: 'Development server',
      },
      {
        url: 'https://api.scarlettx.xyz',
        description: 'Production server',
      },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  });
});

// Serve Scalar API Reference
docsApp.get(
  '/',
  apiReference({
    spec: {
      url: '/docs/openapi.json',
    },
    theme: 'purple',
    layout: 'modern',
    customCss: `
      .scalar-api-reference {
        --scalar-color-1: #6366f1;
        --scalar-color-2: #8b5cf6;
        --scalar-color-accent: #ec4899;
      }
    `,
  })
);

// Alternative: Serve Swagger UI
docsApp.get('/swagger', (c) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scarlett API - Swagger UI</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.onload = () => {
          SwaggerUIBundle({
            url: '/docs/openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout"
          });
        };
      </script>
    </body>
    </html>
  `;
  return c.html(html);
});

// ReDoc alternative
docsApp.get('/redoc', (c) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scarlett API Documentation</title>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      <redoc spec-url="/docs/openapi.json"></redoc>
      <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    </body>
    </html>
  `;
  return c.html(html);
});

export default docsApp;