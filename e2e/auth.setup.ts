/**
 * Auth setup — runs before all tests to create an authenticated session.
 * Stores session cookies to e2e/.auth/user.json for reuse.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

setup('authenticate as demo user', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form with demo credentials
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  await emailInput.fill('user@demo.com');
  await passwordInput.fill('password123');

  // Click sign in
  const signInButton = page.locator('button[type="submit"], button').filter({ hasText: /sign in|log in|submit/i }).first();
  await signInButton.click();

  // Wait for redirect to projects/dashboard
  await page.waitForURL(/projects|dashboard|\/$/,  { timeout: 15_000 });

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
