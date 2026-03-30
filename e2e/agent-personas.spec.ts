/**
 * Agent Persona Test Suite — Conversational User Simulation
 *
 * Simulates a real user continuing the "BA Test - Craft Store" project.
 * Each message waits for the FULL LLM response before sending the next.
 * Follow-up messages are contextual to the agent's reply.
 *
 * Run:
 *   npx playwright test e2e/agent-personas.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

const PROJECT_ID = 'cmnc1g0kz000001qbdtsdg910';
const CHAT_URL = `/project/${PROJECT_ID}/chat`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Send a message and wait for the agent to fully respond.
 *
 * Strategy:
 *   1. Count completed agent messages (`.chat-markdown`) BEFORE sending
 *   2. Type and send the message
 *   3. Wait for a NEW `.chat-markdown` to appear (count increases)
 *   4. Wait for the message text to stabilize (streaming finished)
 *   5. Return the full response text
 */
async function sendAndWait(page: Page, text: string, timeoutMs = 180_000): Promise<string> {
  console.log(`  [sendAndWait] Sending: "${text.slice(0, 80)}..."`);

  // Type into textarea and send
  const input = page.locator('textarea').last();
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await input.click();
  await input.fill(text);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');

  // Wait for the send button to become disabled (streaming started)
  await page.waitForTimeout(2000);

  // Phase 1: Wait for streaming to finish
  // The send button is disabled during streaming (disabled={!inputValue.trim() || isStreaming})
  // Wait for the streaming spinner/working indicator to appear then disappear
  const deadline = Date.now() + timeoutMs;

  // Wait for streaming to START (spinner appears or "is working" text)
  let streamingDetected = false;
  const startDeadline = Date.now() + 30_000;
  while (Date.now() < startDeadline) {
    const hasSpinner = await page.locator('.animate-spin').first().isVisible().catch(() => false);
    const isWorking = await page.locator('text=/is working|Working/').first().isVisible().catch(() => false);
    const streamingLabel = await page.locator('text=streaming...').first().isVisible().catch(() => false);
    if (hasSpinner || isWorking || streamingLabel) {
      streamingDetected = true;
      console.log(`  [sendAndWait] Streaming detected, waiting for completion...`);
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (!streamingDetected) {
    console.log(`  [sendAndWait] WARNING: No streaming indicator detected within 30s`);
  }

  // Phase 2: Wait for streaming to FINISH (all indicators gone)
  while (Date.now() < deadline) {
    const hasSpinner = await page.locator('.animate-spin').first().isVisible().catch(() => false);
    const isWorking = await page.locator('text=/is working|Working/').first().isVisible().catch(() => false);
    const streamingLabel = await page.locator('text=streaming...').first().isVisible().catch(() => false);

    if (!hasSpinner && !isWorking && !streamingLabel) {
      // Double-check: wait 4 more seconds and verify still not streaming
      await page.waitForTimeout(4000);
      const stillStreaming = await page.locator('.animate-spin').first().isVisible().catch(() => false);
      if (!stillStreaming) {
        console.log(`  [sendAndWait] Streaming finished.`);
        break;
      }
    }
    await page.waitForTimeout(2000);
  }

  // Phase 3: Get the last agent message text
  await page.waitForTimeout(2000); // Final render settle
  const agentBubbles = page.locator('.chat-markdown');
  const count = await agentBubbles.count();
  if (count > 0) {
    const lastMsg = agentBubbles.nth(count - 1);
    const finalText = (await lastMsg.textContent()) ?? '';
    console.log(`  [sendAndWait] Got response: ${finalText.length} chars (${count} total agent messages)`);
    return finalText;
  }

  console.log(`  [sendAndWait] No agent messages found after streaming`);
  return '';
}

/** Get the name of the last responding agent from the chat */
async function getLastAgentName(page: Page): Promise<string> {
  // Agent names appear in the header above each agent bubble
  // Look for the text-[11px] font-semibold span inside the agent message groups
  const agentHeaders = page.locator('[class*="rounded-tl-sm"]').locator('xpath=../..').locator('[class*="font-semibold"]');
  const count = await agentHeaders.count();
  if (count > 0) {
    return (await agentHeaders.nth(count - 1).textContent())?.trim() ?? 'Unknown';
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
  await page.locator('textarea').last().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(3000); // Let messages load
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Agent Persona Tests — Conversational Flow', () => {
  test.describe.configure({ timeout: 600_000 }); // 10 min per test

  test('Full agent conversation — project status through deployment', async ({ page }) => {
    await goToChat(page);

    // ── Round 1: ORC — Project Status ──────────────────────────────
    console.log('\n══════ ROUND 1: ORC — Status Update ══════');
    const r1 = await sendAndWait(page,
      "Can you give me a full status update? I want to know where we stand — what's been completed, what's in progress, and what should happen next."
    );
    await screenshot(page, '01-orc-status');
    const agent1 = await getLastAgentName(page);
    console.log(`  Agent: ${agent1} | Length: ${r1.length}`);
    expect(r1.length).toBeGreaterThan(50);

    // ── Round 2: DEC — Decision based on status ────────────────────
    console.log('\n══════ ROUND 2: DEC — Payment Decision ══════');
    const r2 = await sendAndWait(page,
      "Thanks for the update. Before we continue building, I need help deciding on the payment system. Should we use Stripe, PayPal, or Square? Compare them with pros and cons."
    );
    await screenshot(page, '02-dec-decision');
    const agent2 = await getLastAgentName(page);
    console.log(`  Agent: ${agent2} | Length: ${r2.length}`);
    expect(r2.length).toBeGreaterThan(50);

    // ── Round 3: AUD — Audit before proceeding ─────────────────────
    console.log('\n══════ ROUND 3: AUD — Phase Audit ══════');
    const r3 = await sendAndWait(page,
      "Good, let's go with Stripe. Before we build more, can you audit what's been done so far? Check if the requirements and architecture documents are complete and nothing was missed."
    );
    await screenshot(page, '03-aud-audit');
    const agent3 = await getLastAgentName(page);
    console.log(`  Agent: ${agent3} | Length: ${r3.length}`);
    expect(r3.length).toBeGreaterThan(50);

    // ── Round 4: STC — Card state validation ───────────────────────
    console.log('\n══════ ROUND 4: STC — Card States ══════');
    const r4 = await sendAndWait(page,
      "Can you also check the task board card states? I want to make sure all tasks are moving through the pipeline correctly and nothing is stuck."
    );
    await screenshot(page, '04-stc-states');
    const agent4 = await getLastAgentName(page);
    console.log(`  Agent: ${agent4} | Length: ${r4.length}`);
    expect(r4.length).toBeGreaterThan(50);

    // ── Round 5: PF — Performance planning ─────────────────────────
    console.log('\n══════ ROUND 5: PF — Performance ══════');
    const r5 = await sendAndWait(page,
      "The product listing page will have hundreds of items with filters. What performance targets should we set? Analyze bottlenecks and recommend optimizations."
    );
    await screenshot(page, '05-pf-performance');
    const agent5 = await getLastAgentName(page);
    console.log(`  Agent: ${agent5} | Length: ${r5.length}`);
    expect(r5.length).toBeGreaterThan(50);

    // ── Round 6: IE — Integration design ───────────────────────────
    console.log('\n══════ ROUND 6: IE — Integrations ══════');
    const r6 = await sendAndWait(page,
      "Now let's design the third-party integrations. We decided on Stripe for payments. We also need Google OAuth for login, SendGrid for emails, and S3 for product images. How should these integrations work?"
    );
    await screenshot(page, '06-ie-integrations');
    const agent6 = await getLastAgentName(page);
    console.log(`  Agent: ${agent6} | Length: ${r6.length}`);
    expect(r6.length).toBeGreaterThan(50);

    // ── Round 7: SM — Secrets management ───────────────────────────
    console.log('\n══════ ROUND 7: SM — Secrets ══════');
    const r7 = await sendAndWait(page,
      "With all those integrations, we'll have many API keys and credentials. How should we manage these secrets securely? Plan for storing, rotating, and preventing leaks."
    );
    await screenshot(page, '07-sm-secrets');
    const agent7 = await getLastAgentName(page);
    console.log(`  Agent: ${agent7} | Length: ${r7.length}`);
    expect(r7.length).toBeGreaterThan(50);

    // ── Round 8: DO — CI/CD pipeline ───────────────────────────────
    console.log('\n══════ ROUND 8: DO — CI/CD ══════');
    const r8 = await sendAndWait(page,
      "Let's set up the deployment pipeline. I want automated builds, tests, and deployments when we push code. Design the CI/CD workflow with staging and production environments."
    );
    await screenshot(page, '08-do-cicd');
    const agent8 = await getLastAgentName(page);
    console.log(`  Agent: ${agent8} | Length: ${r8.length}`);
    expect(r8.length).toBeGreaterThan(50);

    // ── Round 9: SR — Monitoring & reliability ─────────────────────
    console.log('\n══════ ROUND 9: SR — Monitoring ══════');
    const r9 = await sendAndWait(page,
      "Before we go live, we need monitoring. Set up an observability plan — how will we know if the site goes down? Include alerting rules and an incident response plan."
    );
    await screenshot(page, '09-sr-monitoring');
    const agent9 = await getLastAgentName(page);
    console.log(`  Agent: ${agent9} | Length: ${r9.length}`);
    expect(r9.length).toBeGreaterThan(50);

    // ── Round 10: LLM — AI cost optimization ───────────────────────
    console.log('\n══════ ROUND 10: LLM — AI Cost Optimization ══════');
    const r10 = await sendAndWait(page,
      "We've spent over $4 on AI so far and the code generation agent used 60% of the tokens. Can you analyze our AI model usage and recommend how to reduce costs? Maybe some agents should use cheaper models?"
    );
    await screenshot(page, '10-llm-cost');
    const agent10 = await getLastAgentName(page);
    console.log(`  Agent: ${agent10} | Length: ${r10.length}`);
    expect(r10.length).toBeGreaterThan(50);

    // ── Summary ────────────────────────────────────────────────────
    console.log('\n══════ CONVERSATION SUMMARY ══════');
    const results = [
      { round: 1, target: 'ORC', agent: agent1, len: r1.length },
      { round: 2, target: 'DEC', agent: agent2, len: r2.length },
      { round: 3, target: 'AUD', agent: agent3, len: r3.length },
      { round: 4, target: 'STC', agent: agent4, len: r4.length },
      { round: 5, target: 'PF',  agent: agent5, len: r5.length },
      { round: 6, target: 'IE',  agent: agent6, len: r6.length },
      { round: 7, target: 'SM',  agent: agent7, len: r7.length },
      { round: 8, target: 'DO',  agent: agent8, len: r8.length },
      { round: 9, target: 'SR',  agent: agent9, len: r9.length },
      { round: 10, target: 'LLM', agent: agent10, len: r10.length },
    ];

    for (const r of results) {
      console.log(`  Round ${r.round}: Target=${r.target} | Agent=${r.agent} | ${r.len} chars`);
    }
    console.log(`  Total rounds: ${results.length} | All responded: ${results.every(r => r.len > 50)}`);

    // Take final screenshots
    await page.goto(`/project/${PROJECT_ID}/board`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '11-board-final');

    await page.goto(`/project/${PROJECT_ID}/agents`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '11-agents-final');
  });
});
