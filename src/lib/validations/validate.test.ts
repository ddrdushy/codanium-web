import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateBody } from './validate';

// Simple test schema
const testSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(0).optional(),
  email: z.string().email('Invalid email').optional(),
});

describe('validateBody', () => {
  it('returns data on valid input', () => {
    const { data, error } = validateBody(testSchema, { name: 'John', age: 25 });
    expect(error).toBeNull();
    expect(data).toEqual({ name: 'John', age: 25 });
  });

  it('returns error on invalid input', () => {
    const { data, error } = validateBody(testSchema, { name: '' });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('error response has 400 status', async () => {
    const { error } = validateBody(testSchema, {});
    expect(error).not.toBeNull();
    // NextResponse.json() creates a Response object
    expect(error!.status).toBe(400);
  });

  it('error body contains field-level messages', async () => {
    const { error } = validateBody(testSchema, {});
    expect(error).not.toBeNull();
    const body = await error!.json();
    expect(body.error).toBeDefined();
    expect(body.details).toBeDefined();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0]).toHaveProperty('field');
    expect(body.details[0]).toHaveProperty('message');
  });

  it('returns first error message as top-level error', async () => {
    const { error } = validateBody(testSchema, { name: '', email: 'bad' });
    const body = await error!.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('handles nested field paths', async () => {
    const nested = z.object({
      user: z.object({
        name: z.string().min(1, 'Name required'),
      }),
    });

    const { error } = validateBody(nested, { user: { name: '' } });
    const body = await error!.json();
    const nameError = body.details.find((d: any) => d.field === 'user.name');
    expect(nameError).toBeDefined();
  });

  it('returns typed data matching schema', () => {
    const { data } = validateBody(testSchema, { name: 'Jane', age: 30, email: 'jane@test.com' });
    expect(data!.name).toBe('Jane');
    expect(data!.age).toBe(30);
    expect(data!.email).toBe('jane@test.com');
  });

  it('strips unknown fields', () => {
    const strict = z.object({ name: z.string() }).strict();
    const { data, error } = validateBody(strict, { name: 'Test', extra: 'field' });
    // strict() schemas reject unknown fields
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
