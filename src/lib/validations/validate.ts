import { NextResponse } from 'next/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Validation Result Types
// ---------------------------------------------------------------------------

type ValidationSuccess<T> = { data: T; error: null };
type ValidationFailure = { data: null; error: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ---------------------------------------------------------------------------
// validateBody — Parse & validate request body against a Zod schema
// ---------------------------------------------------------------------------

/**
 * Validate a request body against a Zod schema.
 *
 * Mirrors the `{ session, error }` pattern from `auth-guard.ts`:
 *   const { data, error } = validateBody(schema, body);
 *   if (error) return error;
 *   // data is fully typed
 *
 * Returns a 400 response with human-readable error messages on failure.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));

    return {
      data: null,
      error: NextResponse.json(
        {
          error: errors[0]?.message ?? 'Validation failed',
          details: errors,
        },
        { status: 400 },
      ),
    };
  }

  return { data: result.data, error: null };
}
