import { test, expect } from '@playwright/test';

/**
 * LIVE verification for the voice agent's function-calling round-trip.
 *
 * Unlike voice-assistant.spec.ts (which runs in mock mode and only checks the
 * UI echo), this drives a REAL Gemini Live session through the deployed Worker
 * and asserts the tool round-trip actually happens on the wire:
 *   model → toolCall   (received over the /gemini-live WebSocket)
 *   client → toolResponse (sent back after executing the tool on-device)
 *
 * It needs a real signed-in session, so it signs in inline (same flow as
 * auth.setup.ts) using PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD, and it
 * targets a deployed build via VOICE_VERIFY_URL. It is intentionally skipped
 * unless VOICE_VERIFY_URL is set, so it never runs (or costs Gemini quota) in
 * CI. Run it by hand against a preview deploy:
 *
 *   VOICE_VERIFY_URL=https://<preview>.pages.dev \
 *     npx playwright test e2e/voice-tools-live.spec.ts --project=chromium
 */
const VERIFY_URL = process.env.VOICE_VERIFY_URL;
const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL;
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD;

test.describe('Voice tools — live Gemini round-trip', () => {
  test.skip(!VERIFY_URL, 'live-only: set VOICE_VERIFY_URL to a deployed build');
  test.setTimeout(120_000);

  test('the model calls a tool and we answer it over the WebSocket', async ({ page }) => {
    if (!EMAIL || !PASSWORD) throw new Error('PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD must be set');
    const base = VERIFY_URL!;

    const framesReceived: string[] = [];
    const framesSent: string[] = [];
    const asText = (p: string | Buffer) => (typeof p === 'string' ? p : p.toString('utf8'));
    page.on('websocket', (ws) => {
      if (!ws.url().includes('/gemini-live')) return;
      ws.on('framereceived', (f) => framesReceived.push(asText(f.payload)));
      ws.on('framesent', (f) => framesSent.push(asText(f.payload)));
    });

    // --- sign in (mirrors auth.setup.ts) -------------------------------------
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('you@example.com').fill(EMAIL);
    await page.getByPlaceholder('Your password').fill(PASSWORD);
    await page.getByText('Sign in', { exact: true }).last().click();
    await expect(
      page.locator('[data-testid="aurora-bg"], [data-testid="today-screen"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // Mark onboarded so the route guard leaves us on the Today tab.
    await page.evaluate(() => {
      const sessionId = localStorage.getItem('lifeos_session');
      if (!sessionId) return;
      const now = new Date().toISOString();
      const existing = JSON.parse(localStorage.getItem('lifeos_users') ?? '[]') as Array<{
        id: string;
        [key: string]: unknown;
      }>;
      const filtered = existing.filter((u) => u.id !== sessionId);
      filtered.push({
        id: sessionId, email: 'lifeos-e2e-test@example.com', passwordHash: 'supabase',
        passwordSalt: 'supabase', name: 'E2E Test User', onboardingStage: 100,
        installDate: now, createdAt: now, updatedAt: now,
      });
      localStorage.setItem('lifeos_users', JSON.stringify(filtered));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // --- open the voice sheet and ask a data-grounded question ---------------
    await page.getByTestId('voice-open').click();
    await expect(page.getByTestId('voice-sheet')).toBeVisible();
    // Wait until the session is live (setup sent → LISTENING).
    await expect(page.getByTestId('voice-status')).toHaveText(/LISTENING|CONNECTED/, { timeout: 20000 });

    await page.getByTestId('voice-input').fill('Where did my money go in the last 30 days?');
    await page.getByTestId('voice-send').click();

    // The model should issue a toolCall (getRecentSpending), which our client
    // answers with a toolResponse. Poll the captured frames until both appear.
    await expect
      .poll(() => framesSent.filter((f) => f.includes('"toolResponse"')).length, { timeout: 45000 })
      .toBeGreaterThan(0);

    const toolCalls = framesReceived.filter((f) => f.includes('"toolCall"'));
    const toolResponses = framesSent.filter((f) => f.includes('"toolResponse"'));
    const calledTools = toolCalls
      .flatMap((f) => Array.from(f.matchAll(/"name"\s*:\s*"(\w+)"/g)).map((m) => m[1]))
      .filter((v, i, a) => a.indexOf(v) === i);

    // Give the model a moment to speak its grounded answer after the tool result.
    await page.waitForTimeout(6000);
    const transcript = (await page.getByTestId('voice-transcript').textContent())?.trim() ?? '';

    console.log('[live] toolCall frames    :', toolCalls.length);
    console.log('[live] toolResponse frames:', toolResponses.length);
    console.log('[live] tools the model called:', calledTools.join(', ') || '(none parsed)');
    console.log('[live] assistant transcript:', transcript);

    expect(toolCalls.length, 'model should have requested at least one tool call').toBeGreaterThan(0);
    expect(toolResponses.length, 'client should have answered the tool call').toBeGreaterThan(0);
  });
});
