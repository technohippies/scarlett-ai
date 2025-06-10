import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  emailSchema,
  walletAddressSchema,
  uuidSchema,
  paginationSchema,
  createSessionSchema,
  gradeAudioSchema,
  songQuerySchema,
  tutorAnalysisSchema,
  tutorTtsSchema,
} from '../src/utils/validation';

// Initialize OpenAPI registry
const registry = new OpenAPIRegistry();

// Register schemas
registry.register('Email', emailSchema);
registry.register('WalletAddress', walletAddressSchema);
registry.register('UUID', uuidSchema);
registry.register('Pagination', paginationSchema);

// Define reusable schemas
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  subscriptionStatus: z.enum(['trial', 'active', 'expired', 'cancelled']),
  creditsRemaining: z.number(),
});

const errorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

const successSchema = z.object({
  success: z.literal(true),
});

// Register auth endpoints
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Register a new user',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: emailSchema,
            walletAddress: walletAddressSchema.optional(),
            displayName: z.string().min(1).max(50).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User registered successfully',
      content: {
        'application/json': {
          schema: successSchema.extend({
            user: userSchema,
            token: z.string(),
          }),
        },
      },
    },
    409: {
      description: 'User already exists',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Login user',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: emailSchema.optional(),
            walletAddress: walletAddressSchema.optional(),
          }).refine((data) => data.email || data.walletAddress, {
            message: 'Either email or wallet address is required',
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: successSchema.extend({
            user: userSchema,
            token: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  summary: 'Get current user',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Current user information',
      content: {
        'application/json': {
          schema: successSchema.extend({
            user: userSchema.extend({
              walletAddress: z.string().nullable(),
              avatarUrl: z.string().nullable(),
              subscriptionExpiresAt: z.string().nullable(),
              trialExpiresAt: z.string().nullable(),
              creditsUsed: z.number(),
              creditsLimit: z.number(),
              creditsResetAt: z.string(),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

// Register karaoke endpoints
registry.registerPath({
  method: 'get',
  path: '/api/karaoke/{trackId}',
  summary: 'Get karaoke data for a track',
  tags: ['Karaoke'],
  request: {
    params: z.object({
      trackId: z.string(),
    }),
    query: songQuerySchema,
  },
  responses: {
    200: {
      description: 'Karaoke data',
      content: {
        'application/json': {
          schema: successSchema.extend({
            trackId: z.string(),
            hasKaraoke: z.boolean(),
            song: z.object({
              id: z.string(),
              title: z.string(),
              artist: z.string(),
              album: z.string().optional(),
              artworkUrl: z.string().optional(),
              duration: z.number().optional(),
              difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
            }).optional(),
            lyrics: z.object({
              source: z.string(),
              type: z.enum(['synced', 'unsynced']),
              lines: z.array(z.object({
                id: z.number(),
                timestamp: z.number(),
                text: z.string(),
                duration: z.number(),
                startTime: z.number(),
                endTime: z.number(),
              })),
              totalLines: z.number(),
            }).optional(),
            cached: z.boolean(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/karaoke/start',
  summary: 'Start a karaoke session',
  tags: ['Karaoke'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createSessionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Session created',
      content: {
        'application/json': {
          schema: successSchema.extend({
            sessionId: z.string(),
            message: z.string(),
            session: z.object({
              id: z.string(),
              trackId: z.string(),
              songTitle: z.string(),
              songArtist: z.string(),
              status: z.string(),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    402: {
      description: 'Insufficient credits',
      content: {
        'application/json': {
          schema: errorSchema.extend({
            creditsRequired: z.number(),
            creditsRemaining: z.number(),
          }),
        },
      },
    },
  },
});

// Register songs endpoints
registry.registerPath({
  method: 'get',
  path: '/api/songs/popular',
  summary: 'Get popular songs',
  tags: ['Songs'],
  request: {
    query: paginationSchema.extend({
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Popular songs list',
      content: {
        'application/json': {
          schema: successSchema.extend({
            data: z.array(z.object({
              id: z.string(),
              trackId: z.string(),
              title: z.string(),
              artist: z.string(),
              album: z.string().optional(),
              difficulty: z.string(),
              totalAttempts: z.number(),
              successRate: z.number(),
            })),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              hasMore: z.boolean(),
            }),
          }),
        },
      },
    },
  },
});

// Register health endpoint
registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Health check',
  tags: ['System'],
  responses: {
    200: {
      description: 'System health status',
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['healthy', 'degraded', 'unhealthy']),
            timestamp: z.string(),
            environment: z.string(),
            services: z.object({
              database: z.string(),
              genius: z.string(),
              elevenlabs: z.string(),
              deepgram: z.string(),
              venice: z.string(),
            }),
          }),
        },
      },
    },
  },
});

// Generate OpenAPI document
const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Scarlett Karaoke API',
    description: 'AI-powered karaoke coaching platform API',
    contact: {
      name: 'API Support',
      email: 'support@scarlettx.xyz',
    },
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
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Extension token or API key',
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and management',
    },
    {
      name: 'Karaoke',
      description: 'Karaoke session management and grading',
    },
    {
      name: 'Songs',
      description: 'Song catalog and metadata',
    },
    {
      name: 'System',
      description: 'System health and status',
    },
  ],
});

// Write to file
const outputPath = path.join(__dirname, '..', 'openapi.yaml');
fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));

// Also generate YAML version
import * as yaml from 'js-yaml';
const yamlStr = yaml.dump(document);
fs.writeFileSync(outputPath.replace('.json', '.yaml'), yamlStr);

console.log('✅ OpenAPI documentation generated successfully!');
console.log(`📄 Output: ${outputPath}`);
console.log('\nTo view the documentation:');
console.log('  npm run docs:serve');