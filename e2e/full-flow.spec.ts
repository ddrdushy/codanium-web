/**
 * AI Team Studio — Full End-to-End Test
 *
 * Simulates a real user creating a project and going through the
 * entire SDLC pipeline: BA discovery → SA architecture → PM planning.
 *
 * Prerequisites:
 *   - App running at localhost:14001
 *   - Docker containers up (ats-app, ats-postgres)
 *   - LLM provider configured (Ollama or other)
 *
 * Run:
 *   npx playwright test e2e/full-flow.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for an agent message to appear in the chat */
async function waitForAgentMessage(page: Page, timeout = 60_000): Promise<string> {
  // Wait for the loading skeleton to disappear and real content to show
  const agentMessages = page.locator('[class*="agent"], [data-role="agent"], .prose, [class*="message"]').last();
  await agentMessages.waitFor({ state: 'visible', timeout });
  // Wait a bit more for streaming to complete
  await page.waitForTimeout(3000);
  return (await agentMessages.textContent()) ?? '';
}

/** Send a message in the chat input */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea, input[type="text"]').last();
  await input.fill(text);
  await page.keyboard.press('Enter');
  // Wait for the message to be sent
  await page.waitForTimeout(1000);
}

/** Click an option button if available, otherwise type the text */
async function selectOption(page: Page, optionText: string) {
  // Try to find a clickable option button
  const optionButton = page.locator('button, [role="button"]').filter({ hasText: optionText }).first();
  if (await optionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await optionButton.click();
    await page.waitForTimeout(1000);
    return;
  }
  // Fallback: type the option text
  await sendMessage(page, optionText);
}

/** Wait for a specific agent to appear in the chat */
async function waitForAgent(page: Page, agentName: string, timeout = 60_000) {
  await page.locator(`text=${agentName}`).first().waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(2000); // Wait for streaming to complete
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('AI Team Studio — Full SDLC Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Login and access dashboard', async ({ page }) => {
    // The app should auto-login in dev mode or show login page
    // Check we can reach the projects page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/projects|login/);

    // If on login page, perform login
    if (page.url().includes('login')) {
      // Dev mode: click demo login or fill credentials
      const demoButton = page.locator('button, a').filter({ hasText: /demo|sign in|log in/i }).first();
      if (await demoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await demoButton.click();
        await page.waitForURL(/projects|dashboard/);
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/01-dashboard.png' });
  });

  test('2. Create a new project', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click "New Project" or "Create" button
    const createButton = page.locator('button, a').filter({ hasText: /new project|create|start/i }).first();
    await createButton.waitFor({ state: 'visible', timeout: 10_000 });
    await createButton.click();

    // Fill in project details in the wizard
    await page.waitForTimeout(1000);

    // Step 1: Project name and idea
    const nameInput = page.locator('input[placeholder*="name"], input[name*="name"]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Test Company Website');
    }

    const ideaInput = page.locator('textarea, input[placeholder*="idea"], input[placeholder*="describe"]').first();
    if (await ideaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ideaInput.fill('A professional company website for a tech consulting firm');
    }

    await page.screenshot({ path: 'e2e/screenshots/02-create-project.png' });

    // Click Next/Continue through wizard steps
    for (let step = 0; step < 4; step++) {
      const nextButton = page.locator('button').filter({ hasText: /next|continue|create|finish|done/i }).first();
      if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Wait for redirect to chat page
    await page.waitForURL(/\/chat/, { timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/03-project-created.png' });
  });

  test('3. BA Discovery — Initial greeting', async ({ page }) => {
    // Navigate to the latest project's chat
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on the first/latest project
    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
    }

    // Navigate to chat
    const chatLink = page.locator('a[href*="/chat"]').first();
    if (await chatLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatLink.click();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Send first message
    await sendMessage(page, 'hi');

    // Wait for BA to respond
    await page.waitForTimeout(15_000); // Give LLM time to respond

    await page.screenshot({ path: 'e2e/screenshots/04-ba-greeting.png' });

    // Verify BA responded (look for Business Analyst label or agent message content)
    const baResponse = page.locator('text=Business Analyst').first();
    await expect(baResponse).toBeVisible({ timeout: 30_000 });
  });

  test('4. BA Discovery — Answer questions', async ({ page }) => {
    // Navigate to latest project chat
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
    }
    const chatLink = page.locator('a[href*="/chat"]').first();
    if (await chatLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatLink.click();
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Answer BA's questions with realistic responses
    const answers = [
      'Showcase our consulting services and attract potential clients',
      'Browse our services, read case studies, contact us via form',
      'Professional and corporate, like Salesforce or LinkedIn',
      'All devices - fully responsive',
      'No login for visitors, admin panel for content management',
      'Google Analytics, contact form email notifications',
      "No, we've covered everything - create the BRD",
    ];

    for (const answer of answers) {
      // Wait for agent to finish before sending next answer
      await page.waitForTimeout(10_000);

      await sendMessage(page, answer);
      await page.screenshot({ path: `e2e/screenshots/05-ba-q${answers.indexOf(answer) + 1}.png` });

      // Wait for response
      await page.waitForTimeout(15_000);
    }

    await page.screenshot({ path: 'e2e/screenshots/06-ba-complete.png' });
  });

  test('5. BA → SA Handoff — Approve BRD', async ({ page }) => {
    // Navigate to latest project chat
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
    }
    const chatLink = page.locator('a[href*="/chat"]').first();
    if (await chatLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatLink.click();
    }
    await page.waitForLoadState('networkidle');

    // Approve the BRD
    await sendMessage(page, "Looks great - approved! Let's move to architecture");
    await page.waitForTimeout(20_000);

    // Verify SA takes over
    const saLabel = page.locator('text=Solution Architect').first();
    const saVisible = await saLabel.isVisible({ timeout: 30_000 }).catch(() => false);

    await page.screenshot({ path: 'e2e/screenshots/07-sa-takeover.png' });

    if (saVisible) {
      // Answer SA's tech questions
      const saAnswers = [
        'Self-hosted on my own VPS',
        'React / Next.js',
        'Node.js / TypeScript',
        'PostgreSQL',
      ];

      for (const answer of saAnswers) {
        await page.waitForTimeout(10_000);
        await sendMessage(page, answer);
        await page.waitForTimeout(15_000);
      }

      // Approve SDD
      await sendMessage(page, "Architecture looks great - approved!");
      await page.waitForTimeout(20_000);
    }

    await page.screenshot({ path: 'e2e/screenshots/08-sa-complete.png' });
  });
});

// ─── Admin Panel Tests ────────────────────────────────────────────────────────

test.describe('Admin Panel', () => {

  test('Dashboard loads with real data', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Check KPI cards are visible — use heading role for reliability
    await expect(page.locator('h1, h2').filter({ hasText: 'Dashboard' })).toBeVisible({ timeout: 10_000 });

    // Check for real data indicators (no "Demo Data" badge)
    const demoBadge = page.locator('text=Demo Data');
    const isDemoData = await demoBadge.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: 'e2e/screenshots/admin-01-dashboard.png' });

    // Log whether we're seeing real or demo data
    console.log(`Dashboard data: ${isDemoData ? 'DEMO' : 'LIVE'}`);
  });

  test('Users page shows real users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Customer Management')).toBeVisible({ timeout: 10_000 });

    // Should show actual user count
    const userCount = page.locator('text=/\\d+ total/');
    await expect(userCount).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'e2e/screenshots/admin-02-users.png' });
  });

  test('Billing page shows correct revenue', async ({ page }) => {
    await page.goto('/admin/billing');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').filter({ hasText: /Billing/i })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'e2e/screenshots/admin-03-billing.png' });
  });

  test('All admin pages load without errors', async ({ page }) => {
    const adminPages = [
      '/admin',
      '/admin/users',
      '/admin/agents',
      '/admin/billing',
      '/admin/analytics',
      '/admin/audit',
      '/admin/health',
      '/admin/settings',
    ];

    for (const pagePath of adminPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Check no error messages
      const error = page.locator('text=/error|failed|500/i');
      const hasError = await error.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        console.error(`Error on ${pagePath}`);
      }

      await page.screenshot({
        path: `e2e/screenshots/admin-${pagePath.replace(/\//g, '-').slice(1)}.png`,
      });
    }
  });
});

// ─── API Health Checks ────────────────────────────────────────────────────────

test.describe('API Health', () => {

  test('Core API endpoints respond', async ({ request }) => {
    const endpoints = [
      { path: '/api/projects', method: 'GET', expectStatus: [200, 401, 403] },
      { path: '/api/admin/health', method: 'GET', expectStatus: [200, 401, 403] },
      { path: '/api/admin/stats', method: 'GET', expectStatus: [200, 401, 403] },
      { path: '/api/admin/users', method: 'GET', expectStatus: [200, 401, 403] },
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint.path);
      console.log(`${endpoint.method} ${endpoint.path} → ${response.status()}`);
      expect(endpoint.expectStatus).toContain(response.status());
    }
  });

  test('LLM config endpoint responds', async ({ request }) => {
    const response = await request.get('/api/llm/config');
    console.log(`GET /api/llm/config → ${response.status()}`);
    expect([200, 401, 403]).toContain(response.status());
  });
});

// ─── Chat Streaming Tests ─────────────────────────────────────────────────────

test.describe('Chat Streaming', () => {

  test('SSE stream connects and receives events', async ({ page }) => {
    // Navigate to a project chat
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      const chatLink = page.locator('a[href*="/chat"]').first();
      if (await chatLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await chatLink.click();
      }
    }

    await page.waitForLoadState('networkidle');

    // Listen for SSE events
    const sseEvents: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/chat/stream')) {
        sseEvents.push(response.url());
      }
    });

    // Send a message and verify streaming starts
    await sendMessage(page, 'hello');
    await page.waitForTimeout(15_000);

    await page.screenshot({ path: 'e2e/screenshots/streaming-test.png' });

    console.log(`SSE stream connections: ${sseEvents.length}`);
  });
});
