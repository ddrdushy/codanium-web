#!/usr/bin/env npx tsx
// Full BA Q&A E2E test: Create project, answer all questions, check BRD quality
const BASE = "http://localhost:14001";

async function login() {
  // Step 1: Get CSRF token + cookie
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = await csrfRes.json();
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const csrfCookieStr = csrfCookies.map(c => c.split(";")[0]).join("; ");

  // Step 2: Login with CSRF cookie
  const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email: "user@demo.com", password: "password123", json: "true", redirect: "false" });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookieStr },
    body: body.toString(), redirect: "manual"
  });
  const loginCookies = loginRes.headers.getSetCookie?.() || [];

  // Step 3: Combine all cookies
  const allCookies = [...csrfCookies, ...loginCookies].map(c => c.split(";")[0]).join("; ");

  // Step 4: Verify session
  const sess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: allCookies } }).then(r => r.json());
  if (!sess?.user?.email) throw new Error("Login failed: " + JSON.stringify(sess));
  return allCookies;
}

async function chatStream(cookie: string, pid: string, msg: string) {
  const res = await fetch(`${BASE}/api/projects/${pid}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ content: msg, background: false })
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let content = "", agent = "", buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    let evt = "";
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("event: ")) { evt = t.slice(7); continue; }
      if (t.startsWith("data: ")) {
        try {
          const d = JSON.parse(t.slice(6));
          if (evt === "chunk") content += d.content || "";
          if (evt === "done") agent = d.agentShortName || "";
          if (evt === "error") console.log("  ERROR:", d.message);
          if (evt === "info") console.log("  INFO:", d.message);
        } catch {}
      }
    }
  }
  return { content, agent };
}

async function main() {
  const cookie = await login();
  console.log("STEP 1: Login - PASS\n");

  // Create project
  console.log("STEP 2: Create Project");
  const proj = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "FitTrack - Fitness App",
      description: [
        "Idea: A fitness tracking app that helps users log workouts, track calories, set goals, and share progress with friends.",
        "",
        "Target audience: Health-conscious millennials and Gen Z (ages 20-35) who want a simple social fitness companion.",
        "",
        "Priorities: Beautiful UI, social features, gamification, Apple Health integration."
      ].join("\n"),
      color: "#10b981"
    })
  }).then(r => r.json());
  console.log(`PASS - Created "${proj.name}" (${proj.id})\n`);

  // Wait for PM + BA kickoff
  console.log("STEP 3: Wait for PM + BA auto-kickoff (10s)...");
  await new Promise(r => setTimeout(r, 10000));
  const msgs1 = await fetch(`${BASE}/api/projects/${proj.id}/chat`, { headers: { Cookie: cookie } }).then(r => r.json());
  console.log(`Messages after kickoff: ${msgs1.length}`);
  for (const m of msgs1) {
    console.log(`  [${m.role}] ${m.agent?.shortName || "-"}: ${(m.content || "").substring(0, 80)}...`);
  }
  console.log("");

  // BA Discovery Answers
  const answers = [
    // Answer 1: Core problem & user context
    [
      "I am non-technical, a fitness enthusiast who wants to build an app.",
      "The app name is FitTrack. The core problem is that existing fitness apps are",
      "either too complex (like MyFitnessPal with 100 features) or too simple (basic",
      "step counters). Users want something in between - easy to use but powerful",
      "enough to track real progress. Target users are millennials and Gen Z aged",
      "20-35 who go to the gym 3-5 times a week. They want to log workouts quickly,",
      "see progress charts, and share achievements with friends."
    ].join(" "),

    // Answer 2: Features deep dive
    [
      "Core features: 1) Workout logging with exercise library (200+ pre-built",
      "exercises with muscle groups and form descriptions), 2) Custom workout builder",
      "(drag exercises into routines), 3) Progress tracking with charts (weight, reps,",
      "body measurements over time), 4) Goal setting (weekly workout goals, weight",
      "targets, personal records), 5) Social feed where friends share workouts and",
      "cheer each other, 6) Streak tracking and badges for consistency (First Workout,",
      "7-Day Streak, 30-Day Streak, 100 Workouts, New PR), 7) Apple Health and Google",
      "Fit integration for steps and heart rate, 8) Workout timer with rest period",
      "alerts. No payment processing needed for MVP - free app."
    ].join(" "),

    // Answer 3: Roles, design, brand
    [
      "User roles: Just regular users - no admin panel for MVP. Every user has same",
      "permissions. Design: Modern, energetic, dark mode by default. Primary color:",
      "vibrant green (#10b981). Accent: electric purple (#8b5cf6). Think Nike Training",
      "Club meets Strava. Clean cards for exercises, smooth animations, big bold numbers",
      "for stats. Font: Inter for body, Poppins for headings. Mobile-first, works on",
      "tablet too. No desktop needed for MVP. Company: FitTrack Labs. Tagline: Train",
      "smarter, together."
    ].join(" "),

    // Answer 4: Integrations, notifications, timeline
    [
      "Integrations: Apple HealthKit (sync steps, heart rate, calories burned), Google",
      "Fit (same data for Android). OAuth login via Apple Sign-In and Google. Push",
      "notifications for workout reminders (daily at user-set time), friend activity",
      "(when friends complete workouts), and streak alerts (dont lose your streak!).",
      "No email notifications for MVP - push only. Timeline: MVP in 4 months.",
      "The exercise library should cover: chest, back, shoulders, arms (biceps/triceps),",
      "legs (quads/hamstrings/calves), core, and cardio. Each exercise has: name, muscle",
      "group, equipment needed (barbell/dumbbell/bodyweight/machine), difficulty level",
      "(beginner/intermediate/advanced), and a text description of proper form."
    ].join(" "),

    // Answer 5: Content, onboarding, empty states - request BRD generation
    [
      "Onboarding flow: 1) Sign up with Apple/Google, 2) Set fitness goal (lose weight",
      "/ build muscle / stay active / train for event), 3) Enter current stats (height,",
      "weight, experience level), 4) Pick workout days (Mon-Sun selector), 5) Get a",
      "personalized starter workout plan. Empty states: No workouts page shows: Your",
      "fitness journey starts with one rep - tap + to log your first workout. Social",
      "feed empty: Add friends to see their workouts here. Profile shows: total workouts,",
      "current streak, personal records, badges earned. Error messages: No internet -",
      "You are offline, your workout will sync when you reconnect. Failed to save -",
      "Something went wrong, tap retry to save your workout. Now please generate the",
      "complete BRD with all sections including Executive Summary, Functional Requirements",
      "with FR-IDs, User Personas, User Flows, Non-Functional Requirements, Content",
      "Inventory, Brand Guidelines, Information Architecture, and Priority Matrix."
    ].join(" "),
  ];

  console.log("STEP 4: BA Discovery Q&A");
  for (let i = 0; i < answers.length; i++) {
    console.log(`\n--- Answer ${i + 1}/${answers.length} ---`);
    console.log(`Sending: "${answers[i].substring(0, 70)}..."`);
    const start = Date.now();
    const r = await chatStream(cookie, proj.id, answers[i]);
    console.log(`Agent: ${r.agent} | ${r.content.length} chars | ${Date.now() - start}ms`);
    console.log(`Preview: "${r.content.substring(0, 120).replace(/\n/g, " ")}..."`);
  }

  // Check BRD
  console.log("\n\n" + "=".repeat(80));
  console.log("  STEP 5: BRD QUALITY ASSESSMENT");
  console.log("=".repeat(80));

  const docs = await fetch(`${BASE}/api/projects/${proj.id}/documents`, { headers: { Cookie: cookie } }).then(r => r.json());
  const brd = docs.find((d: any) => d.type === "BRD");

  if (!brd) {
    console.log("FAIL - No BRD document found!");
    process.exit(1);
  }

  const c = brd.content as string;
  const words = c.split(/\s+/).length;
  const frIds = [...new Set(c.match(/FR-\d{3}/g) || [])];
  const nfrIds = [...new Set(c.match(/NFR-\d{3}/g) || [])];
  const cl = c.toLowerCase();

  console.log(`\nTitle:    ${brd.title}`);
  console.log(`Status:   ${brd.status}`);
  console.log(`Words:    ${words}`);
  console.log(`Sections: ${brd.sections}`);
  console.log(`FR-IDs:   ${frIds.length} (${frIds.slice(0, 15).join(", ")}${frIds.length > 15 ? "..." : ""})`);
  console.log(`NFR-IDs:  ${nfrIds.length}`);

  const checks: [string, boolean, string][] = [
    ["Word Count >= 1000", words >= 1000, `${words} words`],
    ["FR-IDs >= 10", frIds.length >= 10, `${frIds.length} IDs`],
    ["NFR-IDs >= 3", nfrIds.length >= 3, `${nfrIds.length} IDs`],
    ["Executive Summary / Vision", cl.includes("executive summary") || cl.includes("project vision"), ""],
    ["Problem Statement", cl.includes("problem") && cl.includes("statement") || cl.includes("pain point") || cl.includes("core problem"), ""],
    ["User Personas (>= 2)", (c.match(/persona/gi) || []).length >= 2, ""],
    ["Functional Requirements", cl.includes("functional requirement"), ""],
    ["Non-Functional Requirements", cl.includes("non-functional") || (cl.includes("performance") && cl.includes("security")), ""],
    ["User Flows / Journeys", cl.includes("user flow") || cl.includes("onboarding") || cl.includes("user journey"), ""],
    ["Information Architecture", cl.includes("architecture") || cl.includes("site map") || cl.includes("navigation"), ""],
    ["Brand & Design", cl.includes("brand") || cl.includes("color") || cl.includes("typography"), ""],
    ["Content Inventory", cl.includes("content") && (cl.includes("empty state") || cl.includes("error message") || cl.includes("onboarding")), ""],
    ["Acceptance Criteria", cl.includes("acceptance"), ""],
    ["MoSCoW Priority", cl.includes("must") && cl.includes("should"), ""],
    ["No Placeholders", !cl.includes("lorem ipsum") && !cl.includes("[insert") && !cl.includes("tbd"), ""],
    ["Project-Specific (FitTrack)", cl.includes("fittrack") || cl.includes("fitness") || cl.includes("workout"), ""],
    ["Integrations (HealthKit/Fit)", cl.includes("health") || cl.includes("google fit") || cl.includes("healthkit"), ""],
    ["Gamification/Social", cl.includes("badge") || cl.includes("streak") || cl.includes("social"), ""],
  ];

  console.log("\nQuality Checks:");
  console.log("-".repeat(70));
  let pass = 0, fail = 0;
  for (const [name, result, detail] of checks) {
    if (result) pass++; else fail++;
    console.log(`  ${result ? "PASS" : "FAIL"} | ${name}${detail ? " — " + detail : ""}`);
  }
  console.log("-".repeat(70));
  console.log(`\nSCORE: ${pass}/${checks.length} (${((pass / checks.length) * 100).toFixed(0)}%)`);

  if (pass >= 16) console.log("RATING: 10/10 — Excellent BRD");
  else if (pass >= 14) console.log("RATING: 8/10 — Good BRD");
  else if (pass >= 10) console.log("RATING: 6/10 — Acceptable");
  else console.log("RATING: Below 5/10 — Needs work");

  // Cards check
  console.log("\n" + "=".repeat(80));
  console.log("  STEP 6: CARDS & BOARD CHECK");
  console.log("=".repeat(80));
  const cardsData = await fetch(`${BASE}/api/projects/${proj.id}/cards`, { headers: { Cookie: cookie } }).then(r => r.json());
  const cards = cardsData.cards || cardsData || [];
  console.log(`\nTotal cards: ${cards.length}`);
  for (const card of cards.slice(0, 15)) {
    console.log(`  [${card.state}] ${card.type} | "${card.title}" → ${card.ownerAgent?.shortName || "?"}`);
  }

  // Print first 4000 chars of BRD
  console.log("\n" + "=".repeat(80));
  console.log("  BRD CONTENT (first 4000 chars)");
  console.log("=".repeat(80));
  console.log(c.substring(0, 4000));
  if (c.length > 4000) console.log(`\n... [${c.length - 4000} more chars, ${words} total words] ...`);
}

main().catch(e => console.error("Fatal:", e));
