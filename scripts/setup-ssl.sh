#!/bin/bash
# ─── Codanium SSL Setup — Run once on the server ─────────────────────────────
# Usage: bash scripts/setup-ssl.sh your@email.com

set -e

EMAIL=${1:?"Usage: $0 your@email.com"}
DOMAIN="codanium.com"

echo "=== Step 1: Ensuring services are running ==="
docker compose up -d nginx app db redis
sleep 3

echo "=== Step 2: Issuing certificate for $DOMAIN ==="
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "=== Step 3: Switching nginx to SSL config ==="
cp nginx-ssl.conf nginx.conf
docker compose exec nginx nginx -s reload

echo "=== Step 4: Starting certbot auto-renewal ==="
docker compose up -d certbot

echo ""
echo "✅ HTTPS is now live at https://$DOMAIN"
