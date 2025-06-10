# Scarlett API Server

Clean, well-organized Cloudflare Workers API for the Scarlett Karaoke platform.

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
npm install

# Run development server
npm run dev

# Type check
npm run type-check

# Deploy to development
npm run deploy

# Deploy to production
npm run deploy:prod
```

## Environment Variables

Configure via `wrangler secret put`:

- `JWT_SECRET`: JWT signing secret
- `GENIUS_API_KEY`: Genius API for song metadata
- `ELEVENLABS_API_KEY`: ElevenLabs for TTS/STT
- `DEEPGRAM_API_KEY`: Deepgram for primary STT
- `VENICE_API_KEY`: Venice AI for coaching

## Database Setup

```bash
# Run migrations (development)
npm run db:migrate

# Run migrations (production)
npm run db:migrate:prod
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

```bash
# Health check
curl http://localhost:8787/api/health

# Register user
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "displayName": "Test User"}'
```