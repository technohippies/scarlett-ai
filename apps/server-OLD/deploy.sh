#!/bin/bash

# Scarlett API Deployment Script
# This script sets up the Cloudflare D1 database, secrets, and deploys the worker

set -e  # Exit on any error

echo "🎤 Deploying Scarlett Karaoke API to Cloudflare..."
echo "=================================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please log in to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

# Environment (default to development)
ENV=${1:-development}
echo "📍 Environment: $ENV"

# Step 1: Create D1 Database
echo ""
echo "📊 Setting up D1 Database..."
if [ "$ENV" = "production" ]; then
    DB_NAME="scarlett-prod"
else
    DB_NAME="scarlett-dev"
fi

echo "Creating database: $DB_NAME"
DB_CREATE_OUTPUT=$(wrangler d1 create $DB_NAME 2>/dev/null || echo "Database may already exist")
echo "$DB_CREATE_OUTPUT"

# Extract database ID from output (if creation was successful)
if echo "$DB_CREATE_OUTPUT" | grep -q "database_id"; then
    DB_ID=$(echo "$DB_CREATE_OUTPUT" | grep "database_id" | cut -d'"' -f4)
    echo "✅ Database ID: $DB_ID"
    echo ""
    echo "📝 Please update wrangler.toml with this database_id:"
    echo "   database_id = \"$DB_ID\""
    echo ""
    read -p "Press Enter after updating wrangler.toml..."
fi

# Step 2: Run Database Migrations
echo ""
echo "🗃️  Running database schema..."
wrangler d1 execute $DB_NAME --env=$ENV --file=./schema.sql

echo "✅ Database schema applied!"

# Step 3: Set up secrets
echo ""
echo "🔐 Setting up secrets..."

# JWT Secret
if [ -z "$JWT_SECRET" ]; then
    echo "Generating random JWT secret..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
fi

echo "Setting JWT_SECRET..."
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env=$ENV

# Optional: Set other secrets if provided
if [ ! -z "$GENIUS_API_KEY" ]; then
    echo "Setting GENIUS_API_KEY..."
    echo "$GENIUS_API_KEY" | wrangler secret put GENIUS_API_KEY --env=$ENV
fi

if [ ! -z "$ELEVENLABS_API_KEY" ]; then
    echo "Setting ELEVENLABS_API_KEY..."
    echo "$ELEVENLABS_API_KEY" | wrangler secret put ELEVENLABS_API_KEY --env=$ENV
fi

echo "✅ Secrets configured!"

# Step 4: Deploy the worker
echo ""
echo "🚀 Deploying worker..."
wrangler deploy --env=$ENV

echo ""
echo "🎉 Deployment complete!"
echo ""

# Step 5: Generate test JWT
echo "🔑 Generating test JWT..."
echo ""

# Set the JWT_SECRET environment variable for the script
export JWT_SECRET=$JWT_SECRET
node scripts/generate-test-jwt.js

echo ""
echo "🌐 Your API is now live!"
if [ "$ENV" = "production" ]; then
    echo "   Production URL: https://scarlett-api.your-account.workers.dev"
else
    echo "   Development URL: https://scarlett-api-dev.your-account.workers.dev"
fi

echo ""
echo "📋 Next steps:"
echo "1. Copy the test JWT above"
echo "2. Update API_CONFIG.BASE_URL in apps/extension/src/config/api.ts"
echo "3. Install the extension and paste the JWT in onboarding"
echo "4. Test karaoke functionality!"

echo ""
echo "🔧 Useful commands:"
echo "   View logs: wrangler tail --env=$ENV"
echo "   Update worker: wrangler deploy --env=$ENV"
echo "   Manage secrets: wrangler secret list --env=$ENV" 