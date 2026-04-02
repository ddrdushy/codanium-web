// =============================================================================
// Codanium — Webhook Signature Verification
// =============================================================================
// HMAC-SHA256 utilities for:
//   - Verifying inbound GitHub webhook signatures
//   - Signing outbound webhook payloads
// Uses timing-safe comparison to prevent timing attacks.
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Inbound Verification (GitHub Webhooks)
// ---------------------------------------------------------------------------

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256 header).
 *
 * GitHub sends: `sha256=<hex-digest>`
 * We compute HMAC-SHA256 of the raw body using the webhook secret and compare.
 *
 * @param payload   Raw request body (string)
 * @param signature X-Hub-Signature-256 header value
 * @param secret    Project's gitWebhookSecret
 * @returns         true if signature is valid
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) return false;

  const receivedHex = signature.slice(expectedPrefix.length);
  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');

  // Timing-safe comparison (both must be same length)
  try {
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    if (receivedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Outbound Signing (Our Webhooks → External Endpoints)
// ---------------------------------------------------------------------------

/**
 * Sign an outbound webhook payload for delivery to an external endpoint.
 *
 * Returns the signature string to be sent as X-Webhook-Signature header.
 * Format: `sha256=<hex-digest>`
 *
 * @param payload  JSON string payload to sign
 * @param secret   Endpoint's shared secret
 * @returns        Signature string (e.g. "sha256=abc123...")
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hmac}`;
}
