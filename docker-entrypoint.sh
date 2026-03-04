#!/bin/sh
set -e

echo "🚀 AI Team Studio — Starting..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy 2>/dev/null || echo "⚠️  No migrations to apply (or first run)"

# Execute the main command
echo "✅ Starting Next.js server..."
exec "$@"
