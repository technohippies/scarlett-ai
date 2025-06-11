#!/bin/bash

# Deploy script for Farcaster mini app

echo "Building Farcaster mini app..."
bun run build

echo "Choose deployment option:"
echo "1. Orbiter (IPFS + Base blockchain)"
echo "2. Cloudflare Pages"
echo "3. Fleek (IPFS)"
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo "Deploying to Orbiter..."
    # Install orbiter CLI if not installed
    if ! command -v orbiter &> /dev/null; then
      npm i -g orbiter-cli
    fi
    
    # Deploy to Orbiter
    orbiter deploy --buildCommand "bun run build" --buildDir "dist"
    ;;
  2)
    echo "Deploying to Cloudflare Pages..."
    # Requires wrangler CLI
    if ! command -v wrangler &> /dev/null; then
      npm i -g wrangler
    fi
    
    wrangler pages deploy dist --project-name=scarlett-farcaster
    ;;
  3)
    echo "Deploying to Fleek..."
    echo "Please use Fleek CLI or web interface"
    echo "Build directory: dist"
    ;;
esac