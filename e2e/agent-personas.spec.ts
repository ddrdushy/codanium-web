/**
 * Agent Persona Test Suite — User Simulation
 *
 * Simulates a real user continuing the "BA Test - Craft Store" project
 * through the chat UI. Each test sends a natural user message designed
 * to trigger a specific untested agent persona.
 *
 * Project State:
 *   - BRD: DONE | SDD: DONE | 22 cards | Code: Auth module generated
 *   - Tested: BA, SA, PM, UX, TL, SD, QA, SEC, CA (9/23)
 *   - Untested: JD, AT, PF, ORC, STC, DEC, AUD, PE, DO, IE, SM, SR, LLM, PRE (14)
 *
 * Run:
 *   npx playwright test e2e/agent-personas.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

const PROJECT_ID = 'cmnc1g0kz000001qbdtsdg910';
const CHAT_URL = `/project/${PROJECT_ID}/chat`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send a message via the chat textarea and press Enter */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').last();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.click();
  await input.fill(text);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
}

/**
 * Wait for the agent to finish streaming its response.
 * Detects streaming by looking for the "is working..." indicator
 * or the spinning loader, then waits for them to disappear.
 */
async function waitForResponse(page: Page, timeoutMs = 150_000): Promise<string> {
  // First, wait a moment for streaming to start
  await page.waitForTimeout(3000);

  // Wait for the streaming indicator to appear (agent is working)
  const workingIndicator = page.locator('text=/is working/i').first();
  const streamingSpinner = page.locator('.animate-spin').first();
  const streamingText = page.locator('text=streaming...').first();

  // Wait up to 10s for streaming to begin
  await Promise.race([
    workingIndicator.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
    streamingSpinner.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
    streamingText.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
  ]);

  // Now wait for streaming to FINISH (all indicators gone)
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const isWorking = await workingIndicator.isVisible().catch(() => false);
    const isSpinning = await streamingSpinner.isVisible().catch(() => false);
    const isStreaming = await streamingText.isVisible().catch(() => false);

    if (!isWorking && !isSpinning && !isStreaming) {
      // Extra wait for final render
      await page.waitForTimeout(2000);
      break;
    }
    await page.waitForTimeout(2000);
  }

  // Get the last agent message text
  const agentMessages = page.locator('[class*="rounded-tl-sm"]');
  const count = await agentMessages.count();
  if (count > 0) {
    const lastMessage = agentMessages.nth(count - 1);
    return (await lastMessage.textContent()) ?? '';
  }
  return '';
}

/** Get the name of the agent that responded (from the message header) */
async function getRespondingAgent(page: Page): Promise<string> {
  // Agent name appears as a bold span above the message bubble
  const agentLabels = page.locator('span.font-semibold, [class*="font-semibold"]').filter({ hasNotText: /you|user/i });
  const count = await agentLabels.count();
  if (count > 0) {
    const lastLabel = agentLabels.nth(count - 1);
    return (await lastLabel.textContent())?.trim() ?? 'Unknown';
  }
  return 'Unknown';
}

/** Take a named screenshot */
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/persona-${name}.png`, fullPage: false });
}

/** Navigate to the Craft Store project chat */
async function goToChat(page: Page) {
  await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' });
  // Wait for chat input to be visible (page is ready)
  await page.locator('textarea').last().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(2000);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Agent Persona Tests — User Simulation', () => {
  // 3 minutes per test — agents can be slow
  test.describe.configure({ timeout: 240_000 });

  // ── GOVERNANCE GROUP ──────────────────────────────────────────────────────

  test('01 — ORC: Request project status update', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "Can you give me a full status update? I want to know where we stand — what's been completed, what's in progress, and what should happen next."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '01-orc-status');

    console.log(`\n[ORC TEST] Responding agent: ${agent}`);
    console.log(`[ORC TEST] Response length: ${response.length} chars`);
    console.log(`[ORC TEST] Preview: ${response.slice(0, 300)}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('02 — DEC: Request a decision on payment gateway', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "I need help deciding on the payment system. Should we go with Stripe, PayPal, or Square for the craft store? Can you compare them for me with pros and cons so I can choose?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '02-dec-payment-decision');

    console.log(`\n[DEC TEST] Responding agent: ${agent}`);
    console.log(`[DEC TEST] Response length: ${response.length} chars`);
    console.log(`[DEC TEST] Has options: ${response.toLowerCase().includes('option') || response.toLowerCase().includes('stripe')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('03 — AUD: Audit the requirements phase', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "Before we go further, I want to make sure everything is solid. Can you audit what's been done so far — check if the requirements document covers everything, the architecture is complete, and nothing was missed?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '03-aud-audit');

    console.log(`\n[AUD TEST] Responding agent: ${agent}`);
    console.log(`[AUD TEST] Response length: ${response.length} chars`);
    console.log(`[AUD TEST] Has audit terms: ${response.toLowerCase().includes('audit') || response.toLowerCase().includes('gate') || response.toLowerCase().includes('complete')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('04 — STC: Check card state consistency', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "Can you check the task board and make sure all the card states are correct? I want to know if any tasks are stuck or if there are problems with how things are moving through the pipeline."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '04-stc-card-states');

    console.log(`\n[STC TEST] Responding agent: ${agent}`);
    console.log(`[STC TEST] Response length: ${response.length} chars`);
    console.log(`[STC TEST] Has state terms: ${response.toLowerCase().includes('state') || response.toLowerCase().includes('card') || response.toLowerCase().includes('progress')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  // ── ENGINEERING GROUP ─────────────────────────────────────────────────────

  test('05 — JD: Assign a simple UI task', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "I need a simple product card component built for the store. It should show the product image, name, price, and artisan name with an Add to Cart button. Can a junior developer handle this?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '05-jd-product-card');

    console.log(`\n[JD TEST] Responding agent: ${agent}`);
    console.log(`[JD TEST] Response length: ${response.length} chars`);
    console.log(`[JD TEST] Has code: ${response.includes('function') || response.includes('const') || response.includes('export') || response.includes('```')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('06 — AT: Request automated test suite', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "We need automated tests for the authentication system. Can you create a full test suite covering registration, login, password reset, and OAuth? I want unit tests and integration tests."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '06-at-test-suite');

    console.log(`\n[AT TEST] Responding agent: ${agent}`);
    console.log(`[AT TEST] Response length: ${response.length} chars`);
    console.log(`[AT TEST] Has test terms: ${response.toLowerCase().includes('test') || response.toLowerCase().includes('jest') || response.toLowerCase().includes('expect')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('07 — PF: Analyze performance requirements', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "I'm worried about performance. The product listing page will have hundreds of items with filters. What performance targets should we set? Can you analyze the bottlenecks and recommend optimizations?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '07-pf-performance');

    console.log(`\n[PF TEST] Responding agent: ${agent}`);
    console.log(`[PF TEST] Response length: ${response.length} chars`);
    console.log(`[PF TEST] Has perf terms: ${response.toLowerCase().includes('performance') || response.toLowerCase().includes('latency') || response.toLowerCase().includes('load')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  // ── PLATFORM GROUP ────────────────────────────────────────────────────────

  test('08 — PE: Design cloud infrastructure', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "Let's plan the hosting. Where should we deploy the craft store? I need recommendations for cloud provider, server setup, database hosting, and file storage. We're expecting about 10,000 users at launch."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '08-pe-infrastructure');

    console.log(`\n[PE TEST] Responding agent: ${agent}`);
    console.log(`[PE TEST] Response length: ${response.length} chars`);
    console.log(`[PE TEST] Has infra terms: ${response.toLowerCase().includes('cloud') || response.toLowerCase().includes('server') || response.toLowerCase().includes('deploy') || response.toLowerCase().includes('aws')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('09 — DO: Set up CI/CD pipeline', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "We need to set up the deployment pipeline. I want automated builds, tests, and deployments when we push code. Can you design the CI/CD workflow with staging and production environments?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '09-do-cicd');

    console.log(`\n[DO TEST] Responding agent: ${agent}`);
    console.log(`[DO TEST] Response length: ${response.length} chars`);
    console.log(`[DO TEST] Has CI/CD terms: ${response.toLowerCase().includes('pipeline') || response.toLowerCase().includes('ci') || response.toLowerCase().includes('deploy') || response.toLowerCase().includes('docker')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('10 — IE: Design third-party integrations', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "We need to integrate several third-party services: Stripe for payments, Google for login, SendGrid for emails, and S3 for product images. Can you design how these integrations should work?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '10-ie-integrations');

    console.log(`\n[IE TEST] Responding agent: ${agent}`);
    console.log(`[IE TEST] Response length: ${response.length} chars`);
    console.log(`[IE TEST] Has integration terms: ${response.toLowerCase().includes('api') || response.toLowerCase().includes('stripe') || response.toLowerCase().includes('integration') || response.toLowerCase().includes('webhook')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('11 — SM: Plan secrets management', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "We'll have API keys for Stripe, SendGrid, Google, and AWS. How should we manage all these secrets securely? I need a plan for storing them, rotating them, and making sure they don't leak."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '11-sm-secrets');

    console.log(`\n[SM TEST] Responding agent: ${agent}`);
    console.log(`[SM TEST] Response length: ${response.length} chars`);
    console.log(`[SM TEST] Has secrets terms: ${response.toLowerCase().includes('secret') || response.toLowerCase().includes('key') || response.toLowerCase().includes('vault') || response.toLowerCase().includes('credential')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('12 — SR: Set up monitoring and reliability', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "Before we go live, we need monitoring. How will we know if the site goes down or gets slow? Set up an observability plan — monitoring, alerts, and what to do when something breaks."
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '12-sr-monitoring');

    console.log(`\n[SR TEST] Responding agent: ${agent}`);
    console.log(`[SR TEST] Response length: ${response.length} chars`);
    console.log(`[SR TEST] Has SRE terms: ${response.toLowerCase().includes('monitor') || response.toLowerCase().includes('alert') || response.toLowerCase().includes('uptime') || response.toLowerCase().includes('incident')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  // ── AI_COST GROUP ─────────────────────────────────────────────────────────

  test('13 — LLM: Optimize AI model usage', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "We've spent over $4 on AI so far and the code generation agent used 60% of the tokens. Can you analyze our AI usage and recommend how to reduce costs? Maybe some agents should use cheaper models?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '13-llm-optimization');

    console.log(`\n[LLM TEST] Responding agent: ${agent}`);
    console.log(`[LLM TEST] Response length: ${response.length} chars`);
    console.log(`[LLM TEST] Has cost terms: ${response.toLowerCase().includes('cost') || response.toLowerCase().includes('token') || response.toLowerCase().includes('model') || response.toLowerCase().includes('optimization')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  test('14 — PRE: Optimize agent prompts', async ({ page }) => {
    await goToChat(page);
    await sendMessage(page,
      "The Business Analyst agent takes 10 rounds of questions and uses 20K tokens per call. Can you review its prompts and suggest how to make it more efficient — fewer rounds, shorter prompts, better output quality?"
    );

    const response = await waitForResponse(page);
    const agent = await getRespondingAgent(page);
    await screenshot(page, '14-pre-prompt-optimization');

    console.log(`\n[PRE TEST] Responding agent: ${agent}`);
    console.log(`[PRE TEST] Response length: ${response.length} chars`);
    console.log(`[PRE TEST] Has prompt terms: ${response.toLowerCase().includes('prompt') || response.toLowerCase().includes('token') || response.toLowerCase().includes('optimize') || response.toLowerCase().includes('instruction')}`);

    expect(response.length).toBeGreaterThan(50);
  });

  // ── VERIFICATION ──────────────────────────────────────────────────────────

  test('15 — Final: Screenshot board and agents page', async ({ page }) => {
    // Board view
    await page.goto(`/project/${PROJECT_ID}/board`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await screenshot(page, '15-board-final');

    // Agents page
    await page.goto(`/project/${PROJECT_ID}/agents`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await screenshot(page, '15-agents-final');

    // Documents page
    await page.goto(`/project/${PROJECT_ID}/documents`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await screenshot(page, '15-documents-final');

    // Overview/dashboard
    await page.goto(`/project/${PROJECT_ID}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await screenshot(page, '15-overview-final');

    console.log('\n=== All 14 agent persona tests completed ===');
  });
});
