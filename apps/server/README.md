# Scarlett API Server

Clean, well-organized Cloudflare Workers API for the Scarlett Karaoke platform.

## Current Deployment Status

- **Development**: ✅ Deployed at https://scarlett-api-dev.deletion-backup782.workers.dev
- **Production**: ❌ Not yet deployed

## Architecture

```
src/
├── config/          # Configuration and environment settings
├── middleware/      # Reusable middleware (auth, CORS, validation)
├── routes/          # Route handlers organized by domain
├── services/        # Business logic and external integrations
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Key Improvements Over Legacy Server

1. **Clean Service Layer**: All services properly exported from index
2. **Type Safety**: Strict TypeScript with no `any` types
3. **Proper Error Handling**: Custom error classes with consistent responses
4. **Middleware Architecture**: Reusable validation, auth, and CORS
5. **Separation of Concerns**: Routes only handle HTTP, services handle logic
6. **Configuration Management**: Environment-based configuration

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Type check
bun run type-check

# Deploy to Cloudflare Workers
./deploy.sh              # Deploy to development
./deploy.sh production   # Deploy to production
```

## Environment Variables

### Local Development
Create a `.dev.vars` file with:
```env
JWT_SECRET=your_jwt_secret
GENIUS_API_KEY=your_genius_key
ELEVENLABS_API_KEY=your_elevenlabs_key
DEEPGRAM_API_KEY=your_deepgram_key
VENICE_API_KEY=your_venice_key
```

### Production Deployment
Configure via `wrangler secret put`:

- `JWT_SECRET`: JWT signing secret (required)
- `GENIUS_API_KEY`: Genius API for song metadata
- `ELEVENLABS_API_KEY`: ElevenLabs for TTS/STT
- `DEEPGRAM_API_KEY`: Deepgram for primary STT
- `VENICE_API_KEY`: Venice AI for coaching

## Database Setup

The API uses Cloudflare D1 (SQLite) for data storage.

### Development Database
- Database ID: `c0cebf07-8c3b-4c03-9ecd-589d9a8346e6`
- Already created and configured in `wrangler.toml`

### Running Migrations
```bash
# Development
wrangler d1 execute scarlett-dev --file=./schema/migrations/001_initial.sql --env=development

# Production (when ready)
wrangler d1 execute scarlett-prod --file=./schema/migrations/001_initial.sql --env=production
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user
- `POST /auth/refresh` - Refresh token

### Karaoke
- `GET /api/karaoke/:trackId` - Get karaoke data
- `POST /api/karaoke/start` - Start session
- `POST /api/karaoke/grade` - Grade line
- `GET /api/karaoke/session/:id` - Get session

### Songs
- `GET /api/songs/popular` - Popular songs
- `GET /api/songs/trending` - Trending songs
- `GET /api/songs/:id` - Song details
- `GET /api/songs/:id/leaderboard` - Song leaderboard

### Other
- `GET /api/health` - Health check
- `POST /api/speech-to-text` - General STT

## Testing

### Demo Token
For quick testing, use the demo token:
```
scarlett_test_demo_user_12345
```

### Example Requests

```bash
# Health check
curl https://scarlett-api-dev.deletion-backup782.workers.dev/api/health

# Get demo token
curl -X POST https://scarlett-api-dev.deletion-backup782.workers.dev/auth/demo

# Get karaoke data (with demo token)
curl https://scarlett-api-dev.deletion-backup782.workers.dev/api/karaoke/ed-sheeran/shape-of-you \
  -H "Authorization: Bearer scarlett_test_demo_user_12345"

# Register user
curl -X POST https://scarlett-api-dev.deletion-backup782.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "displayName": "Test User"}'
```

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete endpoint documentation.