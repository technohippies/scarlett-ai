# Scarlett Farcaster Mini App

A karaoke mini app for Farcaster that lets users sing songs, get AI-powered feedback, and compete with friends.

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## Testing in Farcaster

1. Run the dev server: `bun run dev`
2. Go to https://farcaster.xyz/~/developers/mini-apps/debug
3. Enter `http://localhost:3001`
4. Click "Preview"

## Deployment Options

### Option 1: Orbiter (IPFS + Blockchain) - Recommended

```bash
# Install Orbiter CLI
npm i -g orbiter-cli

# Authenticate
orbiter auth

# Deploy (uses orbiter.json config)
orbiter deploy
```

Your app will be available at: `https://scarlett-karaoke.orbiter.website`

### Option 2: Cloudflare Pages

```bash
# Build the app
bun run build

# Deploy with Wrangler
wrangler pages deploy dist --project-name=scarlett-farcaster
```

### Option 3: Manual Deployment

Use the deploy script:
```bash
./deploy.sh
```

## Configuration

### Farcaster Manifest

The manifest at `public/.well-known/farcaster.json` needs to be updated with:
1. Your actual domain
2. A new signature (use the Farcaster Mini App Manifest Tool)
3. Real icon/image URLs

### Environment Variables

Create a `.env` file:
```env
VITE_API_URL=https://scarlett-api-dev.deletion-backup782.workers.dev/api
VITE_NEYNAR_API_KEY=your_key_here
```

## Features (MVP)

- [x] Basic app structure
- [x] Farcaster SDK integration
- [x] User context display
- [ ] Wallet connection
- [ ] Credit system
- [ ] Song selection
- [ ] Karaoke session
- [ ] Social sharing

## Architecture

- **Frontend**: SolidJS + Vite
- **Styling**: CSS with design tokens
- **Deployment**: IPFS (Orbiter) or traditional CDN
- **API**: Cloudflare Workers backend

## Notes on Handshake Domains

Unfortunately, Orbiter doesn't support Handshake (HNS) domains - it only supports ENS and their subdomains. If you need HNS domain support, consider:
1. Using Cloudflare Pages with HNS DNS configuration
2. Self-hosting on IPFS with your own gateway
3. Using a service that bridges HNS to traditional DNS