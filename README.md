# Scarlett AI - Karaoke Application

AI-powered karaoke coaching platform with real-time feedback and scoring.

## Overview

Scarlett is a comprehensive karaoke platform that combines AI-powered speech recognition, real-time scoring, and personalized coaching to help users improve their singing skills.

## Project Structure

```
├── apps/
│   ├── server/        # Cloudflare Workers API backend
│   ├── extension/     # Chrome extension for YouTube integration
│   └── web/          # Web application (Farcaster frames, web, wallet)
├── packages/
│   ├── ui/           # Shared UI components (Solid.js)
│   ├── typescript-config/  # Shared TypeScript config
│   └── eslint-config/     # Shared ESLint config
└── docs/             # Documentation
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update) for Cloudflare Workers
- Chrome/Chromium browser for extension development

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/scarlett-turbo-2.git
cd scarlett-turbo-2

# Install dependencies
bun install

# Run development servers
bun run dev
```

This will start:
- API Server at http://localhost:8787
- Extension development build
- UI component development server

## Components

### API Server

The backend API is deployed on Cloudflare Workers and provides:
- User authentication (email/wallet)
- Karaoke session management
- Real-time speech-to-text grading
- Song discovery and leaderboards

**Status**: ✅ Deployed (Development)
- URL: https://scarlett-api-dev.deletion-backup782.workers.dev
- [API Documentation](./apps/server/API_DOCUMENTATION.md)

### Chrome Extension

Integrates with YouTube to provide:
- Automatic karaoke track detection
- Synchronized lyrics display
- Real-time scoring and feedback
- Session recording and playback

**Status**: 🚧 In Development

### Web Application

Multi-context web app supporting:
- Full karaoke experience
- Farcaster frame integration
- Wallet-based authentication
- User profiles and stats
- Social features
- Song catalog browsing

**Status**: ✅ Active

### Farcaster Integration

The web app includes Farcaster frame support for:
- Sharing karaoke performances
- Social challenges
- Community leaderboards

**Status**: ✅ Active (within web app)

## Development

### Running Individual Apps

```bash
# API Server only
cd apps/server && bun run dev

# Extension only
cd apps/extension && bun run dev

# UI Components (Storybook)
cd packages/ui && bun run storybook
```

### Testing

```bash
# Run all tests
bun test

# Run specific app tests
cd apps/server && bun test
```

### Building for Production

```bash
# Build all apps
bun run build

# Deploy API to Cloudflare
cd apps/server && ./deploy.sh production

# Build extension for Chrome Web Store
cd apps/extension && bun run build
```

## Architecture

### Tech Stack

- **Backend**: Cloudflare Workers, Hono.js, D1 Database
- **Frontend**: Solid.js, TypeScript, Tailwind CSS
- **Extension**: WXT Framework, Chrome Extension Manifest V3
- **Build Tools**: Bun, Vite, Turbo

### Key Features

- **Real-time STT**: Multiple providers (ElevenLabs, Deepgram)
- **AI Coaching**: Venice AI integration for personalized feedback
- **Lyrics Sync**: LRCLib and Genius API integration
- **Authentication**: JWT-based with wallet support
- **Scoring Algorithm**: Advanced phonetic matching and timing analysis

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: See individual app READMEs
- Issues: [GitHub Issues](https://github.com/yourusername/scarlett-turbo-2/issues)
- Discord: [Join our community](#)

## Acknowledgments

- [LRCLib](https://lrclib.net) for synchronized lyrics
- [Genius](https://genius.com) for song metadata
- [ElevenLabs](https://elevenlabs.io) for speech synthesis
- [Venice AI](https://venice.ai) for AI coaching