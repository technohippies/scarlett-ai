#!/bin/bash

# Scarlett API Deployment Script
set -e

echo "🎤 Deploying Scarlett Karaoke API..."
echo "===================================="

# Check dependencies
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Environment
ENV=${1:-development}
echo "📍 Environment: $ENV"

# Database name
if [ "$ENV" = "production" ]; then
    DB_NAME="scarlett-prod"
else
    DB_NAME="scarlett-dev"
fi

# Step 1: Create database if needed
echo ""
echo "📊 Checking D1 Database..."
if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating database: $DB_NAME"
    DB_OUTPUT=$(wrangler d1 create $DB_NAME)
    DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | cut -d'"' -f4)
    echo "✅ Database created with ID: $DB_ID"
    echo ""
    echo "⚠️  Please update wrangler.toml with this database_id"
    read -p "Press Enter after updating wrangler.toml..."
else
    echo "✅ Database already exists"
fi

# Step 2: Run migrations
echo ""
echo "🗃️  Running database migrations..."
wrangler d1 execute $DB_NAME --env=$ENV --file=./schema/migrations/001_initial.sql
echo "✅ Database schema applied!"

# Step 3: Check secrets
echo ""
echo "🔐 Checking secrets..."
REQUIRED_SECRETS=("JWT_SECRET")
OPTIONAL_SECRETS=("GENIUS_API_KEY" "ELEVENLABS_API_KEY" "DEEPGRAM_API_KEY" "VENICE_API_KEY")

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! wrangler secret list --env=$ENV | grep -q "$secret"; then
        echo "❌ Missing required secret: $secret"
        echo "Please set it with: wrangler secret put $secret --env=$ENV"
        exit 1
    fi
done

for secret in "${OPTIONAL_SECRETS[@]}"; do
    if ! wrangler secret list --env=$ENV | grep -q "$secret"; then
        echo "⚠️  Optional secret not set: $secret"
    fi
done

# Step 4: Deploy
echo ""
echo "🚀 Deploying worker..."
if [ "$ENV" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the health endpoint"
echo "2. Configure any missing optional secrets"
echo "3. Update your frontend API URL"

# Output URLs
if [ "$ENV" = "production" ]; then
    echo ""
    echo "🌐 Production URL: https://scarlett-api.[your-subdomain].workers.dev"
else
    echo ""
    echo "🌐 Development URL: https://scarlett-api-dev.[your-subdomain].workers.dev"
fi