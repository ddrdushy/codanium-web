#!/bin/bash
# ─── Codanium SSL Setup — Run once on the server ─────────────────────────────
# Usage: bash scripts/setup-ssl.sh your@email.com
#
# Must be run AFTER docker compose up -d (nginx must be running for ACME)

set -e

EMAIL=${1:?"Usage: $0 your@email.com"}
DOMAIN="codanium.com"

echo "=== Step 1: Starting services (nginx needs to be up for ACME challenge) ==="
docker compose up -d nginx app db redis

echo "=== Waiting for nginx to be ready ==="
sleep 5

echo "=== Step 2: Issuing certificate for $DOMAIN ==="
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "=== Step 3: Reloading nginx with SSL config ==="
docker compose exec nginx nginx -s reload

echo "=== Step 4: Starting certbot auto-renewal daemon ==="
docker compose up -d certbot

echo ""
echo "✅ SSL setup complete!"
echo "   https://$DOMAIN is now live"
echo "   Certs auto-renew every 12h"
