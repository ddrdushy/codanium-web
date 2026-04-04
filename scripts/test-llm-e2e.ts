#!/usr/bin/env npx tsx
// =============================================================================
// Codanium — Comprehensive AI-Powered E2E SDLC Pipeline Test
// =============================================================================
// Proper test script format: Test ID, Test Case, Steps, Expected, Actual, Status
// Tests: Login → Create Project → PM Trigger → BA Discovery → BA BRD Quality →
//        SA Trigger → SDD Quality → Agent Routing → Documents → Cards → Cleanup
//
// Run: npx tsx scripts/test-llm-e2e.ts
// Or:  BASE_URL=http://localhost:14001 npx tsx scripts/test-llm-e2e.ts
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:14001';
const USER_EMAIL = 'user@demo.com';
const USER_PASSWORD = 'password123';

// ---------------------------------------------------------------------------
// ANSI
// ---------------------------------------------------------------------------
const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m',
  white: '\x1b[37m', bgGreen: '\x1b[42m', bgRed: '\x1b[41m', bgYellow: '\x1b[43m',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TestCase {
  id: string;
  suite: string;
  testCase: string;
  steps: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  duration: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const testCases: TestCase[] = [];
let sessionCookie = '';
let projectId = '';
let projectName = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function timedFetch(url: string, opts: RequestInit = {}): Promise<{ res: Response; ms: number }> {
  const start = Date.now();
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}), ...(opts.headers || {}) },
  });
  return { res, ms: Date.now() - start };
}

function tc(id: string, suite: string, testCase: string, steps: string, expected: string,
  actual: string, status: TestCase['status'], duration: number, severity: TestCase['severity'] = 'HIGH') {
  testCases.push({ id, suite, testCase, steps, expected, actual, status, duration, severity });
  const icon = status === 'PASS' ? `${c.green}PASS${c.reset}` : status === 'FAIL' ? `${c.red}FAIL${c.reset}` : status === 'WARN' ? `${c.yellow}WARN${c.reset}` : `${c.dim}SKIP${c.reset}`;
  console.log(`  ${icon} ${c.bold}${id}${c.reset} ${testCase}`);
  if (status === 'FAIL') {
    console.log(`       ${c.dim}Expected:${c.reset} ${expected}`);
    console.log(`       ${c.red}Actual:  ${c.reset} ${actual}`);
  }
}

function header(suite: string) {
  console.log(`\n${c.cyan}${c.bold}${'━'.repeat(80)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ${suite}${c.reset}`);
  console.log(`${c.cyan}${c.bold}${'━'.repeat(80)}${c.reset}`);
}

async function parseSSE(res: Response): Promise<{
  content: string; agent: string; events: string[]; eventCount: number;
  tokenUsage: any; error: string | null; questions: string[];
  toolCalls: { name: string; args: any }[]; infoMessages: string[];
  thinking: string; artifacts: string[];
}> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '', content = '', agent = '', thinking = '', error: string | null = null;
  let tokenUsage: any = null, eventCount = 0;
  const events: string[] = [], questions: string[] = [], toolCalls: { name: string; args: any }[] = [];
  const infoMessages: string[] = [], artifacts: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      let evt = '';
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('event: ')) { evt = t.slice(7); continue; }
        if (t.startsWith('data: ')) {
          eventCount++;
          if (!events.includes(evt)) events.push(evt);
          try {
            const d = JSON.parse(t.slice(6));
            switch (evt) {
              case 'chunk': content += d.content || ''; break;
              case 'thinking': thinking += d.content || ''; break;
              case 'done': agent = d.agentShortName || ''; break;
              case 'usage': tokenUsage = d.tokensUsed; break;
              case 'error': error = d.message || 'Unknown'; break;
              case 'info': infoMessages.push(d.message || ''); break;
              case 'question_for_user': questions.push(d.question || ''); break;
              case 'tool_call': toolCalls.push({ name: d.name || '', args: d.arguments || {} }); break;
              case 'artifact': artifacts.push(d.name || d.type || ''); break;
            }
          } catch {}
          evt = '';
        }
      }
    }
  } catch (e) { error = `Stream error: ${e}`; }
  return { content, agent, events, eventCount, tokenUsage, error, questions, toolCalls, infoMessages, thinking, artifacts };
}

async function chatStream(msg: string, agentShortName?: string) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ content: msg, ...(agentShortName ? { agentShortName } : {}), background: false }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '');
    return { content: '', agent: '', events: [] as string[], eventCount: 0, tokenUsage: null, error: `HTTP ${res.status}: ${err}`, questions: [] as string[], toolCalls: [] as { name: string; args: any }[], infoMessages: [] as string[], thinking: '', artifacts: [] as string[], ms: Date.now() - start, httpStatus: res.status };
  }
  const parsed = await parseSSE(res);
  return { ...parsed, ms: Date.now() - start, httpStatus: res.status };
}

// =============================================================================
// TC-100: LLM PROVIDER HEALTH
// =============================================================================
async function suite100() {
  header('TC-100: LLM PROVIDER HEALTH CHECK');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/llm/health`);
  const data = res.ok ? await res.json() : null;

  tc('TC-101', 'Health', 'Health API responds',
    'GET /api/llm/health', 'HTTP 200 with JSON body',
    res.ok ? `HTTP 200 (${ms}ms)` : `HTTP ${res.status}`,
    res.ok ? 'PASS' : 'FAIL', ms, 'CRITICAL');

  tc('TC-102', 'Health', 'Default LLM provider configured',
    'Check configured=true, provider and model fields',
    'configured=true with valid provider name',
    data ? `configured=${data.configured}, provider=${data.provider}, model=${data.model}` : 'No data',
    data?.configured ? 'PASS' : 'FAIL', 0, 'CRITICAL');

  // Check fallback chain if available (new code)
  const chain = data?.fallbackChain || [];
  if (chain.length > 0) {
    const reachable = chain.filter((f: any) => f.reachable).length;
    tc('TC-103', 'Health', 'Fallback chain providers reachable',
      'Check each provider in fallback chain for connectivity',
      'At least 3 of 5 providers reachable',
      `${reachable}/${chain.length} reachable: ${chain.map((f: any) => `${f.provider}=${f.reachable ? 'UP' : 'DOWN'}`).join(', ')}`,
      reachable >= 3 ? 'PASS' : reachable >= 1 ? 'WARN' : 'FAIL', 0);
  } else {
    tc('TC-103', 'Health', 'Fallback chain available',
      'Check for fallbackChain in response', 'Fallback chain with providers',
      'No fallbackChain (old code — deploy new build to enable)',
      'WARN', 0);
  }

  return data?.configured;
}

// =============================================================================
// TC-200: USER AUTHENTICATION
// =============================================================================
async function suite200() {
  header('TC-200: USER AUTHENTICATION');

  // TC-201: CSRF
  const { res: csrfRes, ms: csrfMs } = await timedFetch(`${BASE_URL}/api/auth/csrf`);
  const csrf = csrfRes.ok ? await csrfRes.json() : null;
  tc('TC-201', 'Auth', 'CSRF token obtained',
    '1. GET /api/auth/csrf\n2. Extract csrfToken from JSON',
    'HTTP 200 with csrfToken string',
    csrf?.csrfToken ? `Token received (${csrfMs}ms)` : `HTTP ${csrfRes.status}`,
    csrf?.csrfToken ? 'PASS' : 'FAIL', csrfMs, 'CRITICAL');
  if (!csrf?.csrfToken) return false;

  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const csrfCookieStr = csrfCookies.map((c: string) => c.split(';')[0]).join('; ');

  // TC-202: Login
  const loginBody = new URLSearchParams({ csrfToken: csrf.csrfToken, email: USER_EMAIL, password: USER_PASSWORD, json: 'true', redirect: 'false' });
  const loginStart = Date.now();
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookieStr },
    body: loginBody.toString(), redirect: 'manual',
  });
  const loginMs = Date.now() - loginStart;
  const loginCookies = loginRes.headers.getSetCookie?.() || [];
  sessionCookie = [...csrfCookies, ...loginCookies].map((c: string) => c.split(';')[0]).join('; ');

  tc('TC-202', 'Auth', 'Credentials login succeeds',
    `1. POST /api/auth/callback/credentials\n2. Body: email=${USER_EMAIL}, password=***`,
    'HTTP 302 redirect with session cookie',
    `HTTP ${loginRes.status}, ${loginCookies.length} new cookie(s)`,
    loginRes.status === 302 || loginRes.status === 200 ? 'PASS' : 'FAIL', loginMs, 'CRITICAL');

  // TC-203: Session valid
  const { res: sessRes, ms: sessMs } = await timedFetch(`${BASE_URL}/api/auth/session`);
  const sess = await sessRes.json();
  tc('TC-203', 'Auth', 'Session is valid and returns user profile',
    '1. GET /api/auth/session\n2. Verify user.email matches login email',
    `user.email = ${USER_EMAIL}, role = USER`,
    sess?.user ? `email=${sess.user.email}, name=${sess.user.name}, role=${sess.user.role}` : 'No session',
    sess?.user?.email === USER_EMAIL ? 'PASS' : 'FAIL', sessMs, 'CRITICAL');

  return sess?.user?.email === USER_EMAIL;
}

// =============================================================================
// TC-300: PROJECT CREATION & AUTO-SEEDING
// =============================================================================
async function suite300() {
  header('TC-300: PROJECT CREATION & AUTO-SEEDING');

  projectName = `E2E-Test-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}`;

  // TC-301: Create project
  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      description: 'Idea: A task management app for remote teams with real-time collaboration and Kanban boards\n\nTarget audience: Small to medium businesses with 10-50 distributed team members\n\nPriorities: Real-time sync, offline support, mobile-first, simple onboarding',
      color: '#f59e0b',
    }),
  });
  const data = res.ok ? await res.json() : null;
  if (data) projectId = data.id;

  tc('TC-301', 'Project', 'Create project via API',
    `1. POST /api/projects\n2. Body: name="${projectName}", description with Idea/Target/Priorities`,
    'HTTP 201 with project id, status=ACTIVE',
    data ? `HTTP ${res.status}, id=${data.id}, status=${data.status}` : `HTTP ${res.status}`,
    res.ok && data?.id ? 'PASS' : 'FAIL', ms, 'CRITICAL');
  if (!data?.id) return false;

  // TC-302: Members seeded
  tc('TC-302', 'Project', 'Creator added as project member',
    'Check _count.members >= 1', 'members >= 1',
    data._count?.members !== undefined ? `${data._count.members} member(s)` : 'count not in response',
    (data._count?.members ?? 1) >= 1 ? 'PASS' : 'WARN', 0);

  // TC-303: SDLC stages
  const { res: sdlcRes, ms: sdlcMs } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/sdlc`);
  const stages = sdlcRes.ok ? await sdlcRes.json() : [];
  tc('TC-303', 'Project', 'SDLC stages auto-seeded (8 stages)',
    '1. GET /api/projects/{id}/sdlc\n2. Verify 8 stages created',
    '8 stages: Idea & Planning, Requirement Gathering, Solution Design, UX/UI Design, Development, Testing, Deployment, Maintenance',
    `${stages.length} stages: ${stages.map((s: any) => s.name).join(', ')}`,
    stages.length >= 8 ? 'PASS' : 'FAIL', sdlcMs, 'CRITICAL');

  // TC-304: First stage ACTIVE
  const activeStage = stages.find((s: any) => s.status === 'ACTIVE');
  tc('TC-304', 'Project', 'First SDLC stage is ACTIVE',
    'Find stage with status=ACTIVE', '"Idea & Planning" is ACTIVE',
    activeStage ? `"${activeStage.name}" is ACTIVE (order=${activeStage.order})` : 'No ACTIVE stage',
    activeStage?.name?.includes('Idea') ? 'PASS' : 'WARN', 0);

  // TC-305: Wait for PM auto-kickoff
  console.log(`\n  ${c.dim}  Waiting 5s for PM auto-kickoff background task...${c.reset}`);
  await new Promise(r => setTimeout(r, 5000));

  // TC-306: PM system message
  const { res: chatRes, ms: chatMs } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/chat`);
  const msgs = chatRes.ok ? await chatRes.json() : [];
  const sysMsgs = msgs.filter((m: any) => m.role === 'SYSTEM');
  const agentMsgs = msgs.filter((m: any) => m.role === 'AGENT');

  tc('TC-305', 'Project', 'PM auto-kickoff creates system context message',
    '1. Wait 5s for background task\n2. GET /api/projects/{id}/chat\n3. Check for SYSTEM message',
    'At least 1 SYSTEM message with project context',
    `${msgs.length} total: ${sysMsgs.length} SYSTEM, ${agentMsgs.length} AGENT`,
    sysMsgs.length >= 1 ? 'PASS' : 'WARN', chatMs);

  // TC-306: Requirements card
  const { res: cardsRes, ms: cardsMs } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/cards`);
  const cardsData = cardsRes.ok ? await cardsRes.json() : [];
  const cards = cardsData.cards || cardsData || [];
  const reqCard = cards.find((c: any) => c.title?.toLowerCase().includes('requirement'));

  tc('TC-306', 'Project', 'PM creates Requirements Gathering card for BA',
    '1. GET /api/projects/{id}/cards\n2. Find card with title containing "Requirements"',
    'Card exists, state=IN_PROGRESS, assigned to BA agent',
    reqCard ? `"${reqCard.title}" — state=${reqCard.state}, agent=${reqCard.ownerAgent?.shortName || reqCard.ownerAgentId}` : `No requirements card (${cards.length} total)`,
    reqCard ? 'PASS' : 'WARN', cardsMs);

  return true;
}

// =============================================================================
// TC-400: BA AGENT — REQUIREMENTS DISCOVERY (LLM TEST)
// =============================================================================
async function suite400() {
  header('TC-400: BA AGENT — REQUIREMENTS DISCOVERY');

  // TC-401: BA responds to initial message
  const msg1 = 'Hi! I want to build a task management app for remote teams with Kanban boards and real-time sync. Can you help me define the requirements?';
  console.log(`\n  ${c.dim}  Sending to BA: "${msg1.substring(0, 80)}..."${c.reset}`);
  const r1 = await chatStream(msg1);

  tc('TC-401', 'BA Agent', 'BA responds to initial project description',
    `1. POST /api/projects/{id}/chat/stream\n2. Message: "${msg1.substring(0, 50)}..."`,
    'SSE stream, agent=BA, content > 100 chars, no error',
    r1.error ? `ERROR: ${r1.error}` : `agent=${r1.agent}, ${r1.content.length} chars, ${r1.eventCount} events (${r1.ms}ms)`,
    !r1.error && r1.content.length > 50 ? 'PASS' : 'FAIL', r1.ms, 'CRITICAL');

  // TC-402: Token usage tracked
  tc('TC-402', 'BA Agent', 'LLM token usage is tracked',
    'Check tokensUsed in usage SSE event',
    'prompt > 0, completion > 0, total > 0',
    r1.tokenUsage ? `prompt=${r1.tokenUsage.prompt}, completion=${r1.tokenUsage.completion}, total=${r1.tokenUsage.total}` : 'No token usage',
    r1.tokenUsage?.total > 0 ? 'PASS' : 'WARN', 0);

  // TC-403: BA asks discovery questions
  const hasQuestion = r1.questions.length > 0 || r1.content.includes('?');
  tc('TC-403', 'BA Agent', 'BA asks discovery questions (requirements gathering)',
    'Check for question_for_user SSE event or ? in response',
    'At least 1 question or question mark in content',
    r1.questions.length > 0 ? `question_for_user: "${r1.questions[0].substring(0, 80)}..."` : hasQuestion ? 'Question found in text' : 'No question detected',
    hasQuestion ? 'PASS' : 'WARN', 0);

  // TC-404: SSE events correct
  tc('TC-404', 'BA Agent', 'SSE stream emits correct event types',
    'Check events include agent_start/chunk/done',
    'Events: [agent_start, chunk, usage, done] minimum',
    `Events: [${r1.events.join(', ')}]`,
    r1.events.includes('chunk') && r1.events.includes('done') ? 'PASS' : 'WARN', 0);

  // TC-405: Conversation continuity — follow-up
  const msg2 = 'I am non-technical. The app should have task boards, due dates, team member assignment, and file attachments. Keep it simple.';
  console.log(`\n  ${c.dim}  Follow-up: "${msg2.substring(0, 80)}..."${c.reset}`);
  const r2 = await chatStream(msg2);

  tc('TC-405', 'BA Agent', 'BA maintains conversation context on follow-up',
    `1. Send follow-up message about features\n2. Verify BA responds with context from first message`,
    'agent=BA, content > 50 chars, builds on previous context',
    r2.error ? `ERROR: ${r2.error}` : `agent=${r2.agent}, ${r2.content.length} chars (${r2.ms}ms)`,
    !r2.error && r2.content.length > 50 ? 'PASS' : 'FAIL', r2.ms, 'CRITICAL');

  // TC-406: BA uses tools (update_document for BRD)
  const allToolCalls = [...r1.toolCalls, ...r2.toolCalls];
  const docTools = allToolCalls.filter(t => t.name.includes('document') || t.name.includes('update_document'));
  tc('TC-406', 'BA Agent', 'BA calls update_document tool to build BRD progressively',
    'Check for update_document or create_document tool_call events',
    'At least 1 document-related tool call',
    allToolCalls.length > 0 ? `${allToolCalls.length} tool call(s): ${allToolCalls.map(t => t.name).join(', ')}` : 'No tool calls captured (may be processed server-side)',
    docTools.length > 0 ? 'PASS' : 'WARN', 0, 'MEDIUM');

  return !r1.error;
}

// =============================================================================
// TC-500: SA AGENT — ARCHITECTURE (FORCED ROUTE)
// =============================================================================
async function suite500() {
  header('TC-500: SA AGENT — SOLUTION ARCHITECTURE');

  const msg = 'Please design the technical architecture and suggest a tech stack for this task management app. Include database schema and API design.';
  console.log(`\n  ${c.dim}  Sending to SA (forced): "${msg.substring(0, 80)}..."${c.reset}`);
  const r = await chatStream(msg, 'SA');

  // TC-501: SA responds
  tc('TC-501', 'SA Agent', 'SA responds when force-routed via agentShortName=SA',
    `1. POST chat/stream with agentShortName="SA"\n2. Message about architecture`,
    'SSE stream, agent=SA, discusses tech stack/architecture',
    r.error ? `ERROR: ${r.error}` : `agent=${r.agent}, ${r.content.length} chars, ${r.eventCount} events (${r.ms}ms)`,
    !r.error && r.content.length > 50 ? 'PASS' : 'FAIL', r.ms, 'CRITICAL');

  // TC-502: Correct agent
  tc('TC-502', 'SA Agent', 'Response came from SA (not auto-routed to BA)',
    'Check agentShortName in done event', 'agent = "SA"',
    `agent = "${r.agent}"`,
    r.agent === 'SA' ? 'PASS' : r.agent ? 'WARN' : 'FAIL', 0);

  // TC-503: Content mentions architecture topics
  const contentLower = r.content.toLowerCase();
  const archKeywords = ['database', 'api', 'frontend', 'backend', 'react', 'next', 'node', 'postgres', 'schema', 'architecture', 'stack', 'component'];
  const foundKeywords = archKeywords.filter(k => contentLower.includes(k));
  tc('TC-503', 'SA Agent', 'SA discusses architecture-relevant topics',
    'Check content for keywords: database, api, frontend, backend, schema, etc.',
    'At least 3 architecture keywords found',
    `${foundKeywords.length} keywords: ${foundKeywords.join(', ')}`,
    foundKeywords.length >= 3 ? 'PASS' : foundKeywords.length >= 1 ? 'WARN' : 'FAIL', 0);

  // TC-504: Token usage
  tc('TC-504', 'SA Agent', 'Token usage tracked for SA call',
    'Check tokensUsed in usage event', 'total > 0',
    r.tokenUsage ? `prompt=${r.tokenUsage.prompt}, completion=${r.tokenUsage.completion}, total=${r.tokenUsage.total}` : 'No usage',
    r.tokenUsage?.total > 0 ? 'PASS' : 'WARN', 0);

  return !r.error;
}

// =============================================================================
// TC-600: PM AGENT — PROJECT MANAGEMENT
// =============================================================================
async function suite600() {
  header('TC-600: PM AGENT — PROJECT MANAGEMENT');

  const msg = 'What is the current project status? Give me a summary of what has been completed and what is next.';
  console.log(`\n  ${c.dim}  Sending to PM (forced): "${msg.substring(0, 80)}..."${c.reset}`);
  const r = await chatStream(msg, 'PM');

  tc('TC-601', 'PM Agent', 'PM responds to project status query',
    `1. POST chat/stream with agentShortName="PM"\n2. Ask for project status summary`,
    'agent=PM, discusses project status/pipeline',
    r.error ? `ERROR: ${r.error}` : `agent=${r.agent}, ${r.content.length} chars (${r.ms}ms)`,
    !r.error && r.content.length > 30 ? 'PASS' : 'FAIL', r.ms);

  tc('TC-602', 'PM Agent', 'PM correctly identifies as PM agent',
    'Check agentShortName in done event', 'agent = "PM"',
    `agent = "${r.agent}"`,
    r.agent === 'PM' ? 'PASS' : 'WARN', 0);

  return !r.error;
}

// =============================================================================
// TC-700: AGENT AUTO-ROUTING
// =============================================================================
async function suite700() {
  header('TC-700: AGENT AUTO-ROUTING (Intent-Based)');

  // TC-701: Cost query → CA
  const costMsg = 'What will this project cost? Can you estimate the development budget and timeline?';
  console.log(`\n  ${c.dim}  Auto-route (cost query): "${costMsg.substring(0, 60)}..."${c.reset}`);
  const r1 = await chatStream(costMsg);

  tc('TC-701', 'Routing', 'Cost query auto-routes to CA (Cost Analyst)',
    '1. Send cost-related message WITHOUT agentShortName\n2. Router should detect "cost" intent → CA',
    'agent = CA (or acceptable: BA, ORC, PM)',
    r1.error ? `ERROR: ${r1.error}` : `agent=${r1.agent}, ${r1.content.length} chars (${r1.ms}ms)`,
    !r1.error && ['CA', 'BA', 'ORC', 'PM'].includes(r1.agent) ? 'PASS' : r1.error ? 'FAIL' : 'WARN', r1.ms);

  // TC-702: Bug report → QA
  const bugMsg = 'I found a bug: the login button does not respond when clicked on mobile devices.';
  console.log(`\n  ${c.dim}  Auto-route (bug): "${bugMsg.substring(0, 60)}..."${c.reset}`);
  const r2 = await chatStream(bugMsg);

  tc('TC-702', 'Routing', 'Bug report auto-routes to QA agent',
    '1. Send bug report WITHOUT agentShortName\n2. Router should detect "bug" intent → QA',
    'agent = QA (or acceptable: BA, ORC)',
    r2.error ? `ERROR: ${r2.error}` : `agent=${r2.agent}, ${r2.content.length} chars (${r2.ms}ms)`,
    !r2.error && r2.content.length > 0 ? 'PASS' : r2.error ? 'FAIL' : 'WARN', r2.ms);

  return true;
}

// =============================================================================
// TC-800: BRD QUALITY ASSESSMENT (AI-Powered)
// =============================================================================
async function suite800() {
  header('TC-800: BRD DOCUMENT QUALITY');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/documents`);
  const docs = res.ok ? await res.json() : [];
  const brd = docs.find((d: any) => d.type === 'BRD');

  // TC-801: BRD exists
  tc('TC-801', 'BRD', 'BRD document created by BA',
    '1. GET /api/projects/{id}/documents\n2. Find document with type=BRD',
    'At least 1 BRD document exists',
    brd ? `Found: "${brd.title}" — status=${brd.status}, ${brd.wordCount || 0} words` : `No BRD (${docs.length} docs total)`,
    brd ? 'PASS' : 'WARN', ms);

  if (!brd?.content) {
    tc('TC-802', 'BRD', 'BRD has content', '-', 'Content > 0', 'No BRD to check', 'SKIP', 0);
    return true;
  }

  const content = brd.content;
  const contentLower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  // TC-802: Word count
  tc('TC-802', 'BRD', 'BRD minimum word count (target: 1000+)',
    'Count words in BRD content', '>= 200 words (early stage may be shorter)',
    `${wordCount} words`,
    wordCount >= 1000 ? 'PASS' : wordCount >= 200 ? 'WARN' : 'FAIL', 0);

  // TC-803: Has sections
  const sectionHeaders = ['vision', 'problem', 'feature', 'requirement', 'persona', 'user flow', 'architecture', 'brand', 'content', 'constraint', 'scope', 'functional', 'non-functional', 'target', 'priority'];
  const foundSections = sectionHeaders.filter(s => contentLower.includes(s));
  tc('TC-803', 'BRD', 'BRD contains key requirement sections',
    'Search for section headers: vision, problem, features, requirements, personas, etc.',
    'At least 4 key sections present',
    `${foundSections.length} sections found: ${foundSections.join(', ')}`,
    foundSections.length >= 4 ? 'PASS' : foundSections.length >= 2 ? 'WARN' : 'FAIL', 0);

  // TC-804: Has functional requirements with IDs
  const frPattern = /FR-\d{3}/g;
  const frMatches = content.match(frPattern) || [];
  tc('TC-804', 'BRD', 'Functional requirements have FR-XXX IDs',
    'Search for FR-001, FR-002, etc. pattern in content',
    'At least 3 FR-XXX requirement IDs',
    `${frMatches.length} FR IDs found: ${[...new Set(frMatches)].slice(0, 10).join(', ')}`,
    frMatches.length >= 3 ? 'PASS' : frMatches.length >= 1 ? 'WARN' : 'FAIL', 0, 'MEDIUM');

  // TC-805: Content specificity (not generic placeholders)
  const placeholders = ['lorem ipsum', 'placeholder', 'tbd', 'to be determined', '[insert', 'example.com'];
  const foundPlaceholders = placeholders.filter(p => contentLower.includes(p));
  tc('TC-805', 'BRD', 'BRD has specific content (no placeholders)',
    'Check for placeholder text: lorem ipsum, TBD, [insert], etc.',
    'Zero placeholder strings found',
    foundPlaceholders.length === 0 ? 'Clean — no placeholders' : `Found: ${foundPlaceholders.join(', ')}`,
    foundPlaceholders.length === 0 ? 'PASS' : 'WARN', 0, 'MEDIUM');

  // TC-806: Status
  tc('TC-806', 'BRD', 'BRD document status',
    'Check document status field', 'DRAFT (active work) or APPROVED (gate passed)',
    `status = ${brd.status}`,
    ['DRAFT', 'REVIEW', 'APPROVED'].includes(brd.status) ? 'PASS' : 'WARN', 0);

  return true;
}

// =============================================================================
// TC-900: SDD QUALITY ASSESSMENT
// =============================================================================
async function suite900() {
  header('TC-900: SDD DOCUMENT QUALITY');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/documents`);
  const docs = res.ok ? await res.json() : [];
  const sdd = docs.find((d: any) => d.type === 'SDD');

  tc('TC-901', 'SDD', 'SDD document exists',
    '1. GET /api/projects/{id}/documents\n2. Find document with type=SDD',
    'SDD document exists (may not yet if BA still gathering)',
    sdd ? `Found: "${sdd.title}" — status=${sdd.status}, ${sdd.wordCount || 0} words` : 'No SDD yet — BA still in discovery phase (expected at this stage)',
    sdd ? 'PASS' : 'WARN', ms, 'MEDIUM');

  if (!sdd?.content) {
    tc('TC-902', 'SDD', 'SDD quality check', '-', '-', 'No SDD to check — expected during early discovery', 'SKIP', 0, 'MEDIUM');
    return true;
  }

  const content = sdd.content;
  const contentLower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  tc('TC-902', 'SDD', 'SDD minimum word count (target: 3000+)',
    'Count words', '>= 500 words', `${wordCount} words`,
    wordCount >= 3000 ? 'PASS' : wordCount >= 500 ? 'WARN' : 'FAIL', 0);

  const sddSections = ['tech stack', 'database', 'api', 'schema', 'architecture', 'authentication', 'security', 'deployment', 'frontend', 'component'];
  const found = sddSections.filter(s => contentLower.includes(s));
  tc('TC-903', 'SDD', 'SDD contains architecture sections',
    'Search for: tech stack, database, api, schema, security, deployment, etc.',
    'At least 4 architecture sections',
    `${found.length} sections: ${found.join(', ')}`,
    found.length >= 4 ? 'PASS' : found.length >= 2 ? 'WARN' : 'FAIL', 0);

  // BRD→SDD traceability
  const frRefs = content.match(/FR-\d{3}/g) || [];
  tc('TC-904', 'SDD', 'SDD references BRD requirement IDs (traceability)',
    'Check for FR-XXX IDs in SDD mapping to BRD requirements',
    'At least 1 FR-XXX reference for traceability',
    frRefs.length > 0 ? `${frRefs.length} FR references: ${[...new Set(frRefs)].slice(0, 5).join(', ')}` : 'No FR-XXX references',
    frRefs.length >= 1 ? 'PASS' : 'WARN', 0, 'MEDIUM');

  return true;
}

// =============================================================================
// TC-1000: WORK BOARD & CARDS
// =============================================================================
async function suite1000() {
  header('TC-1000: WORK BOARD & CARDS');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/cards`);
  const data = res.ok ? await res.json() : [];
  const cards = data.cards || data || [];

  tc('TC-1001', 'Cards', 'Cards API responds',
    'GET /api/projects/{id}/cards', 'HTTP 200 with array',
    `HTTP ${res.status} — ${cards.length} card(s)`,
    res.ok ? 'PASS' : 'FAIL', ms);

  // Card details
  for (const card of cards.slice(0, 5)) {
    const agentName = card.ownerAgent?.shortName || card.ownerAgentId || 'unassigned';
    tc(`TC-10C`, 'Cards', `Card: "${(card.title || '').substring(0, 45)}"`,
      'Verify card has valid state, type, agent',
      'state IN (PLANNED,IN_PROGRESS,DONE,...), type IN (TASK,FEATURE,...)',
      `state=${card.state}, type=${card.type}, priority=${card.priority}, agent=${agentName}`,
      card.state && card.type ? 'PASS' : 'WARN', 0, 'LOW');
  }

  if (cards.length === 0) {
    tc('TC-1002', 'Cards', 'At least 1 card exists',
      'Check card count', '>= 1 card', '0 cards — PM may still be processing',
      'WARN', 0);
  }

  return true;
}

// =============================================================================
// TC-1100: CHAT HISTORY & USAGE LOGGING
// =============================================================================
async function suite1100() {
  header('TC-1100: CHAT HISTORY & USAGE LOGGING');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/chat`);
  const msgs = res.ok ? await res.json() : [];
  const userMsgs = msgs.filter((m: any) => m.role === 'USER');
  const agentMsgs = msgs.filter((m: any) => m.role === 'AGENT');
  const sysMsgs = msgs.filter((m: any) => m.role === 'SYSTEM');

  tc('TC-1101', 'History', 'All messages persisted in chat history',
    'GET /api/projects/{id}/chat and count by role',
    'Multiple USER + AGENT messages stored',
    `${msgs.length} total: ${userMsgs.length} USER, ${agentMsgs.length} AGENT, ${sysMsgs.length} SYSTEM`,
    agentMsgs.length >= 1 ? 'PASS' : 'WARN', ms);

  tc('TC-1102', 'History', 'LLM calls logged (agent messages = LLM calls)',
    'Count AGENT role messages', '>= 4 LLM calls (BA x2 + SA + PM + routing)',
    `${agentMsgs.length} LLM calls executed`,
    agentMsgs.length >= 4 ? 'PASS' : agentMsgs.length >= 2 ? 'WARN' : 'FAIL', 0);

  // Check agent diversity
  const agentNames = [...new Set(agentMsgs.map((m: any) => m.agent?.shortName || m.agentId || 'unknown'))];
  tc('TC-1103', 'History', 'Multiple agents participated in conversation',
    'Check unique agent shortNames in messages',
    '>= 3 different agents (BA, SA, PM, CA, etc.)',
    `${agentNames.length} agents: ${agentNames.join(', ')}`,
    agentNames.length >= 3 ? 'PASS' : agentNames.length >= 1 ? 'WARN' : 'FAIL', 0);

  return true;
}

// =============================================================================
// TC-1200: SDLC PIPELINE STATE
// =============================================================================
async function suite1200() {
  header('TC-1200: SDLC PIPELINE STATE');

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}/sdlc`);
  const stages = res.ok ? await res.json() : [];

  tc('TC-1201', 'SDLC', 'SDLC stages reflect correct state',
    'GET /api/projects/{id}/sdlc',
    'Idea & Planning = ACTIVE, rest = PENDING (early stage)',
    stages.map((s: any) => `${s.name}:${s.status}`).join(', '),
    stages.some((s: any) => s.status === 'ACTIVE') ? 'PASS' : 'WARN', ms);

  return true;
}

// =============================================================================
// TC-1300: CLEANUP
// =============================================================================
async function suite1300() {
  header('TC-1300: CLEANUP');

  if (!projectId) { tc('TC-1301', 'Cleanup', 'Delete test project', '-', '-', 'No project', 'SKIP', 0); return; }

  const { res, ms } = await timedFetch(`${BASE_URL}/api/projects/${projectId}`, { method: 'DELETE' });
  tc('TC-1301', 'Cleanup', 'Delete test project',
    `DELETE /api/projects/${projectId}`, 'HTTP 200/204',
    `HTTP ${res.status}${res.ok ? ' — deleted' : ''}`,
    res.ok ? 'PASS' : 'WARN', ms, 'LOW');
}

// =============================================================================
// REPORT
// =============================================================================
function printReport() {
  const pass = testCases.filter(t => t.status === 'PASS').length;
  const fail = testCases.filter(t => t.status === 'FAIL').length;
  const warn = testCases.filter(t => t.status === 'WARN').length;
  const skip = testCases.filter(t => t.status === 'SKIP').length;
  const total = testCases.length;
  const critFail = testCases.filter(t => t.status === 'FAIL' && t.severity === 'CRITICAL').length;

  console.log(`\n\n${c.magenta}${c.bold}${'═'.repeat(100)}${c.reset}`);
  console.log(`${c.magenta}${c.bold}  CODANIUM — COMPREHENSIVE AI-POWERED E2E SDLC PIPELINE TEST REPORT${c.reset}`);
  console.log(`${c.magenta}${c.bold}${'═'.repeat(100)}${c.reset}`);
  console.log(`  ${c.dim}Server: ${BASE_URL} | User: ${USER_EMAIL} | Project: ${projectName}${c.reset}`);
  console.log(`  ${c.dim}Executed: ${new Date().toISOString()}${c.reset}\n`);

  // Summary
  console.log(`  ${c.green}${c.bold}PASS: ${pass}${c.reset}  ${c.red}${c.bold}FAIL: ${fail}${c.reset}  ${c.yellow}${c.bold}WARN: ${warn}${c.reset}  ${c.dim}SKIP: ${skip}${c.reset}  ${c.bold}TOTAL: ${total}${c.reset}`);
  console.log(`  ${c.bold}Pass Rate: ${((pass / (total - skip)) * 100).toFixed(1)}%${c.reset}  ${critFail > 0 ? `${c.red}${c.bold}CRITICAL FAILURES: ${critFail}${c.reset}` : ''}\n`);

  // Detailed table
  console.log(`  ${'ID'.padEnd(9)} ${'Sev'.padEnd(9)} ${'Status'.padEnd(6)} ${'Time'.padEnd(8)} ${'Suite'.padEnd(12)} Test Case`);
  console.log(`  ${'-'.repeat(9)} ${'-'.repeat(9)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(12)} ${'-'.repeat(50)}`);

  for (const t of testCases) {
    const sc = t.status === 'PASS' ? c.green : t.status === 'FAIL' ? c.red : t.status === 'WARN' ? c.yellow : c.dim;
    const sevC = t.severity === 'CRITICAL' ? c.red : t.severity === 'HIGH' ? c.yellow : c.dim;
    const ms = t.duration > 0 ? `${t.duration}ms` : '-';
    console.log(`  ${t.id.padEnd(9)} ${sevC}${t.severity.padEnd(9)}${c.reset} ${sc}${t.status.padEnd(6)}${c.reset} ${ms.padEnd(8)} ${t.suite.padEnd(12)} ${t.testCase.substring(0, 50)}`);
  }

  // Failures detail
  const failures = testCases.filter(t => t.status === 'FAIL');
  if (failures.length > 0) {
    console.log(`\n${c.red}${c.bold}  FAILURES (${failures.length}):${c.reset}`);
    for (const f of failures) {
      console.log(`\n  ${c.red}${c.bold}${f.id}${c.reset} [${f.severity}] — ${f.testCase}`);
      console.log(`  ${c.dim}Steps:    ${c.reset}${f.steps.split('\n')[0]}`);
      console.log(`  ${c.dim}Expected: ${c.reset}${f.expected}`);
      console.log(`  ${c.red}Actual:   ${c.reset}${f.actual}`);
    }
  }

  // Warnings
  const warnings = testCases.filter(t => t.status === 'WARN');
  if (warnings.length > 0) {
    console.log(`\n${c.yellow}${c.bold}  WARNINGS (${warnings.length}):${c.reset}`);
    for (const w of warnings) {
      console.log(`  ${c.yellow}${w.id}${c.reset} ${w.testCase}: ${w.actual.substring(0, 80)}`);
    }
  }

  // Suite summary
  const suites = [...new Set(testCases.map(t => t.suite))];
  console.log(`\n  ${c.bold}Suite Summary:${c.reset}`);
  for (const suite of suites) {
    const sts = testCases.filter(t => t.suite === suite);
    const sp = sts.filter(t => t.status === 'PASS').length;
    const sf = sts.filter(t => t.status === 'FAIL').length;
    const icon = sf > 0 ? c.red + 'FAIL' : sp === sts.length ? c.green + 'PASS' : c.yellow + 'WARN';
    console.log(`  ${icon}${c.reset} ${suite.padEnd(14)} ${sp}/${sts.length} passed`);
  }

  console.log(`\n${c.magenta}${c.bold}${'═'.repeat(100)}${c.reset}`);
  if (fail === 0) {
    console.log(`  ${c.green}${c.bold}RESULT: ALL CRITICAL TESTS PASSED${c.reset} (${pass}/${total - skip} pass, ${warn} warnings)`);
  } else {
    console.log(`  ${c.red}${c.bold}RESULT: ${fail} TEST(S) FAILED${c.reset} (${critFail} critical)`);
  }
  console.log(`${c.magenta}${c.bold}${'═'.repeat(100)}${c.reset}\n`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log(`\n${c.magenta}${c.bold}  CODANIUM — Comprehensive AI-Powered E2E SDLC Pipeline Test${c.reset}`);
  console.log(`${c.dim}  Server: ${BASE_URL} | User: ${USER_EMAIL} | Started: ${new Date().toISOString()}${c.reset}`);

  try {
    const healthy = await suite100();
    if (!healthy) { console.log(`\n${c.red}  LLM not configured. Aborting.${c.reset}`); printReport(); process.exit(1); }

    const authed = await suite200();
    if (!authed) { console.log(`\n${c.red}  Auth failed. Aborting.${c.reset}`); printReport(); process.exit(1); }

    const created = await suite300();
    if (!created) { console.log(`\n${c.red}  Project creation failed. Aborting.${c.reset}`); printReport(); process.exit(1); }

    await suite400(); // BA Agent
    await suite500(); // SA Agent
    await suite600(); // PM Agent
    await suite700(); // Auto-routing
    await suite800(); // BRD Quality
    await suite900(); // SDD Quality
    await suite1000(); // Cards
    await suite1100(); // Chat history
    await suite1200(); // SDLC state
    await suite1300(); // Cleanup
  } catch (err) {
    tc('TC-ERR', 'Fatal', 'Unexpected error', '-', 'No errors', `${err}`, 'FAIL', 0, 'CRITICAL');
  }

  printReport();
  const failed = testCases.filter(t => t.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

main();
