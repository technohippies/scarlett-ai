# Scarlett API Server

Cloudflare Workers-based API server for the Scarlett Karaoke extension.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables in `.dev.vars`:

```bash
GENIUS_API_KEY=your_genius_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

3. Start the development server:

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

## API Endpoints

### POST `/api/speech-to-text`

Speech-to-text conversion for extension onboarding.

**Request:**

- Method: POST
- Body: FormData with 'audio' file

**Response:**

```json
{
  "success": true,
  "text": "transcribed text",
  "confidence": 0.95,
  "processing_time": 1200
}
```

### GET `/api/karaoke/{track_id}`

Get karaoke data for a track.

**Parameters:**

- `title`: Track title for matching

### POST `/api/grade-audio`

Grade audio performance for karaoke.

## Environment Variables

- `GENIUS_API_KEY`: API key for Genius lyrics service
- `ELEVENLABS_API_KEY`: API key for ElevenLabs speech-to-text service (fallback)
- `DEEPGRAM_API_KEY`: API key for Deepgram speech-to-text service (primary)

## Deployment

For production deployment, add the environment variables to your Cloudflare Worker settings:

```bash
wrangler secret put JWT_SECRET
wrangler secret put GENIUS_API_KEY
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put DEEPGRAM_API_KEY
```

## Services

- **GeniusService**: Matches video titles to songs via Genius API
- **LRCLibService**: Fetches synchronized lyrics
