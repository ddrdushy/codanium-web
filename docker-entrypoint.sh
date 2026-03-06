#!/bin/sh
set -e

echo "AI Team Studio — Starting..."

# Detect if running as worker or app
if [ "$1" = "node" ] && echo "$2" | grep -q "worker"; then
  echo "Starting BullMQ Worker process..."
else
  echo "Starting Next.js server..."
fi

exec "$@"
