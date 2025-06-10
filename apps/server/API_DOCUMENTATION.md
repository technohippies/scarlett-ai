# Scarlett API Documentation

## Overview

The Scarlett API is a RESTful API built on Cloudflare Workers that powers the Scarlett Karaoke platform. It provides endpoints for user authentication, karaoke session management, song discovery, and AI-powered coaching.

## Base URLs

- **Development**: `http://localhost:8787`
- **Production**: `https://api.scarlettx.xyz`

## Authentication

The API uses JWT tokens for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer scarlett_eyJhbGc...
```

Tokens are obtained through the `/auth/login` or `/auth/register` endpoints.

## Rate Limiting

- **Unauthenticated**: 10 requests per minute
- **Authenticated**: 100 requests per minute
- **Credits-based endpoints**: Limited by user's credit balance

## API Documentation Tools

### Interactive Documentation

When running in development, interactive API documentation is available at:

- **Scalar UI** (Recommended): `http://localhost:8787/docs`
- **Swagger UI**: `http://localhost:8787/docs/swagger`
- **ReDoc**: `http://localhost:8787/docs/redoc`

### OpenAPI Specification

The API follows OpenAPI 3.0 specification. The spec file is available at:
- `openapi.yaml` - Human-readable YAML format
- `/docs/openapi.json` - JSON format (runtime)

### Generating Documentation

```bash
# Generate OpenAPI spec from code
npm run docs:generate

# Serve documentation locally
npm run docs:serve
```

## Core Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "displayName": "John Doe",
  "walletAddress": "0x..." // optional
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "subscriptionStatus": "trial",
    "creditsRemaining": 100
  },
  "token": "scarlett_..."
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com"
  // OR
  "walletAddress": "0x..."
}
```

### Karaoke

#### Get Karaoke Data
```http
GET /api/karaoke/{trackId}?title=Song%20Title&artist=Artist%20Name
```

**Response**:
```json
{
  "success": true,
  "trackId": "track-123",
  "hasKaraoke": true,
  "song": {
    "id": "song-uuid",
    "title": "Song Title",
    "artist": "Artist Name",
    "difficulty": "intermediate",
    "artworkUrl": "https://..."
  },
  "lyrics": {
    "source": "lrclib",
    "type": "synced",
    "lines": [
      {
        "id": 0,
        "timestamp": 0,
        "text": "First line of lyrics",
        "duration": 3000,
        "startTime": 0,
        "endTime": 3
      }
    ],
    "totalLines": 50
  }
}
```

#### Start Karaoke Session
```http
POST /api/karaoke/start
Authorization: Bearer scarlett_...
Content-Type: application/json

{
  "trackId": "track-123",
  "songData": {
    "title": "Song Title",
    "artist": "Artist Name",
    "geniusId": "123456" // optional
  }
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session-uuid",
  "message": "Karaoke session started for Artist Name - Song Title",
  "session": {
    "id": "session-uuid",
    "trackId": "track-123",
    "songTitle": "Song Title",
    "songArtist": "Artist Name",
    "status": "active",
    "createdAt": "2024-01-10T12:00:00Z"
  }
}
```

#### Grade Karaoke Line
```http
POST /api/karaoke/grade
Authorization: Bearer scarlett_...
Content-Type: application/json

{
  "sessionId": "session-uuid",
  "lineIndex": 0,
  "audioData": "base64_encoded_audio",
  "expectedText": "First line of lyrics",
  "attemptNumber": 1
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session-uuid",
  "lineIndex": 0,
  "score": 85,
  "feedback": "Great job! Your pronunciation was clear!",
  "transcribedText": "First line of lyrics",
  "wordScores": [
    {
      "word": "First",
      "score": 100,
      "matched": true,
      "phoneticMatch": true
    }
  ],
  "confidence": 0.95
}
```

### Songs

#### Get Popular Songs
```http
GET /api/songs/popular?page=1&limit=20&difficulty=intermediate
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "song-uuid",
      "trackId": "track-123",
      "title": "Popular Song",
      "artist": "Famous Artist",
      "difficulty": "intermediate",
      "totalAttempts": 1523,
      "successRate": 0.78
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}
```

#### Get Song Leaderboard
```http
GET /api/songs/{songId}/leaderboard?limit=10
```

**Response**:
```json
{
  "success": true,
  "songId": "song-uuid",
  "leaderboard": [
    {
      "rank": 1,
      "userId": "user-uuid",
      "displayName": "TopSinger",
      "bestScore": 98,
      "achievedAt": "2024-01-09T15:30:00Z",
      "totalAttempts": 5
    }
  ]
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE" // optional
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `AUTHENTICATION_ERROR` | 401 | Missing or invalid token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Webhooks

The API supports webhooks for certain events:

### Farcaster Integration
```http
POST /webhook/farcaster
Content-Type: application/json
X-Webhook-Signature: sha256=...

{
  "event": "session.completed",
  "data": {
    "sessionId": "...",
    "userId": "...",
    "score": 85
  }
}
```

## SDKs and Examples

### JavaScript/TypeScript

```typescript
import { ScarlettAPI } from '@scarlett/sdk';

const api = new ScarlettAPI({
  token: 'scarlett_...',
  baseURL: 'https://api.scarlettx.xyz'
});

// Start karaoke session
const session = await api.karaoke.startSession({
  trackId: 'track-123',
  songData: {
    title: 'My Song',
    artist: 'Artist Name'
  }
});

// Grade a line
const result = await api.karaoke.gradeLine({
  sessionId: session.id,
  lineIndex: 0,
  audioData: audioBlob,
  expectedText: 'First line'
});
```

### cURL Examples

```bash
# Register user
curl -X POST https://api.scarlettx.xyz/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","displayName":"Test User"}'

# Get karaoke data
curl https://api.scarlettx.xyz/api/karaoke/track-123?title=Song+Title

# Start session (authenticated)
curl -X POST https://api.scarlettx.xyz/api/karaoke/start \
  -H "Authorization: Bearer scarlett_..." \
  -H "Content-Type: application/json" \
  -d '{"trackId":"track-123","songData":{"title":"Song","artist":"Artist"}}'
```

## Best Practices

1. **Authentication**
   - Store tokens securely
   - Refresh tokens before expiration
   - Don't share tokens between users

2. **Rate Limiting**
   - Implement exponential backoff
   - Cache responses when possible
   - Use batch endpoints where available

3. **Error Handling**
   - Always check `success` field
   - Handle specific error codes
   - Provide user-friendly messages

4. **Audio Processing**
   - Use WAV or WebM format
   - Keep files under 10MB
   - Sample rate: 16kHz or higher

5. **Credits**
   - Check credit balance before operations
   - Handle insufficient credit errors
   - Notify users of credit usage

## Changelog

### v1.0.0 (2024-01-10)
- Initial release
- Authentication system
- Karaoke session management
- Song catalog and discovery
- Leaderboards
- Speech-to-text integration

## Support

- **Documentation**: This file and interactive docs
- **Issues**: GitHub Issues
- **Email**: support@scarlettx.xyz
- **Discord**: Join our community server