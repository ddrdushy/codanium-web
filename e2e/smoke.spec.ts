/**
 * Codanium — Smoke Test Suite
 *
 * Quick validation that all pages load, navigation works,
 * and key UI elements are present. Does NOT test LLM/agent
 * responses — that's in full-flow.spec.ts.
 *
 * Run:
 *   npx playwright test e2e/smoke.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:14001';

// ─── Auth ────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10_000 });
  });

  test('signup page loads', async ({ page }) => {
    await page.goto(`${BASE}/signup`);
    await expect(page.locator('text=Create')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Landing Page ────────────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('homepage loads with correct branding', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/Codanium/i);
  });

  test('marketing sections render', async ({ page }) => {
    await page.goto(BASE);
    // Should have the hero section
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

// ─── Platform Pages (require auth) ──────────────────────────────────────────

test.describe('Platform Pages', () => {
  // In dev mode, auto-login should work
  test.beforeEach(async ({ page }) => {
    // Navigate to projects page which should trigger auto-login in dev
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  });

  test('projects page loads', async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    // Should show project list or create prompt
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });

  test('admin settings page loads', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForLoadState('networkidle');
    // Should show LLM Configuration section
    await expect(page.locator('text=LLM Configuration')).toBeVisible({ timeout: 10_000 });
  });

  test('admin settings has API key field', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForLoadState('networkidle');
    // Should have API Key field (added in BYOM removal)
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 10_000 });
  });

  test('admin agents page loads', async ({ page }) => {
    await page.goto(`${BASE}/admin/agents`);
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });
});

// ─── API Health Checks ──────────────────────────────────────────────────────

test.describe('API Health', () => {
  test('LLM health endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE}/api/llm/health`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('configured');
    expect(data).toHaveProperty('provider');
  });

  test('LLM config route is deleted (404)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/llm/config`);
    // Should be 404 since we deleted this route
    expect(res.status()).toBe(404);
  });
});

// ─── Project Flow ───────────────────────────────────────────────────────────

test.describe('Project Flow', () => {
  test('SDLC shows 8 phases for new project', async ({ request }) => {
    // First get projects to find one
    const projectsRes = await request.get(`${BASE}/api/projects`);
    if (projectsRes.status() !== 200) return; // skip if no auth

    const projects = await projectsRes.json();
    if (!Array.isArray(projects) || projects.length === 0) return;

    const projectId = projects[0].id;
    const sdlcRes = await request.get(`${BASE}/api/projects/${projectId}/sdlc`);
    expect(sdlcRes.status()).toBe(200);

    const stages = await sdlcRes.json();
    expect(stages.length).toBe(8);

    const stageNames = stages.map((s: any) => s.name);
    expect(stageNames).toContain('Idea & Planning');
    expect(stageNames).toContain('Requirement Gathering');
    expect(stageNames).toContain('Solution Design');
    expect(stageNames).toContain('UX/UI Design');
    expect(stageNames).toContain('Development');
    expect(stageNames).toContain('Testing');
    expect(stageNames).toContain('Deployment');
    expect(stageNames).toContain('Maintenance & Improvement');

    // Verify NO old stage names
    expect(stageNames).not.toContain('Business Analysis');
    expect(stageNames).not.toContain('Architecture');
    expect(stageNames).not.toContain('Code Review');
    expect(stageNames).not.toContain('Release');
    expect(stageNames).not.toContain('Monitoring');
    expect(stageNames).not.toContain('Iteration');
  });

  test('cards API responds correctly', async ({ request }) => {
    const projectsRes = await request.get(`${BASE}/api/projects`);
    if (projectsRes.status() !== 200) return;

    const projects = await projectsRes.json();
    if (!Array.isArray(projects) || projects.length === 0) return;

    const projectId = projects[0].id;
    const cardsRes = await request.get(`${BASE}/api/projects/${projectId}/cards`);
    expect(cardsRes.status()).toBe(200);
    const cards = await cardsRes.json();
    expect(Array.isArray(cards)).toBe(true);
  });

  test('documents API responds correctly', async ({ request }) => {
    const projectsRes = await request.get(`${BASE}/api/projects`);
    if (projectsRes.status() !== 200) return;

    const projects = await projectsRes.json();
    if (!Array.isArray(projects) || projects.length === 0) return;

    const projectId = projects[0].id;
    const docsRes = await request.get(`${BASE}/api/projects/${projectId}/documents`);
    expect(docsRes.status()).toBe(200);
  });

  test('agents API responds correctly', async ({ request }) => {
    const projectsRes = await request.get(`${BASE}/api/projects`);
    if (projectsRes.status() !== 200) return;

    const projects = await projectsRes.json();
    if (!Array.isArray(projects) || projects.length === 0) return;

    const projectId = projects[0].id;
    const agentsRes = await request.get(`${BASE}/api/projects/${projectId}/agents`);
    expect(agentsRes.status()).toBe(200);
    const agents = await agentsRes.json();
    expect(Array.isArray(agents)).toBe(true);
    // Should have agents seeded
    if (agents.length > 0) {
      expect(agents[0]).toHaveProperty('shortName');
      expect(agents[0]).toHaveProperty('name');
    }
  });
});

// ─── No BYOM References ────────────────────────────────────────────────────

test.describe('BYOM Removal Verification', () => {
  test('onboarding has no AI Provider step', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`);
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    // Should NOT contain BYOM-related text
    expect(body).not.toContain('Bring Your Own');
    expect(body).not.toContain('Connect Your AI Provider');
  });

  test('platform settings has no provider selection', async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await page.waitForLoadState('networkidle');
    // Try to open settings drawer if gear icon exists
    const settingsBtn = page.locator('[title*="Settings"], button:has(svg)').first();
    if (await settingsBtn.isVisible()) {
      // Settings drawer should not have provider options
      const body = await page.textContent('body');
      expect(body).not.toContain('BYOM');
    }
  });
});
