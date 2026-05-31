import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Playwright auth setup — signs in once and saves browser storage state
// so all subsequent tests can reuse the authenticated session.
//
// Uses PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD from environment.
// Create a test user in Supabase first:
//   1. Go to your Supabase dashboard → Authentication → Users → Add user
//   2. Set email: lifeos-test@example.com, password: (strong), auto-confirm
//   3. Store in .env.test (gitignored)
//
// Or programmatically via Supabase admin:
//   npx ts-node e2e/create-test-user.ts

export const STORAGE_STATE_PATH = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';

  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set.\n' +
      'Create a test user in Supabase, then add to .env.test:\n' +
      '  PLAYWRIGHT_TEST_EMAIL=lifeos-test@example.com\n' +
      '  PLAYWRIGHT_TEST_PASSWORD=your-strong-password\n'
    );
  }

  // Land at root and let the layout guard route us to (auth)/welcome.
  // Direct navigation to /sign-in fights the guard's redirect chain
  // (net::ERR_ABORTED). Use domcontentloaded — Expo dev keeps a websocket
  // open that prevents networkidle from ever firing.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click the welcome screen's "Sign in" link. exact:true isolates it from
  // any subtitle that contains "Sign in" as a substring.
  await page.getByText('Sign in', { exact: true }).first().click();
  await page.waitForTimeout(1500);

  // Fill credentials on the sign-in screen
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  // The Button component renders Pressable + Body. Its title text is exactly
  // "Sign in". On /sign-in the subtitle is "Sign in to continue building
  // your life." — substring match, so we still need exact:true. The .last()
  // picks the form's submit button (last "Sign in" text on the page).
  await page.getByText('Sign in', { exact: true }).last().click();

  // Wait for sign-in to settle. aurora-bg renders on both Today and
  // onboarding screens, so this only confirms auth succeeded — not which
  // screen we're on.
  await expect(
    page.locator('[data-testid="aurora-bg"], [data-testid="today-screen"]').first()
  ).toBeVisible({ timeout: 15000 });

  // Mark the user as onboarded. A fresh Supabase user has no `lifeos_users`
  // localStorage row, so the app reads onboardingStage as 0 and the route
  // guard sends them to /(onboarding)/day1-vision — but our authenticated
  // specs target the post-onboarding app surface (Profile, Today, etc.).
  // Inject a complete user row keyed to the just-signed-in Supabase id so
  // the guard treats them as fully onboarded.
  await page.evaluate(() => {
    const sessionId = localStorage.getItem('lifeos_session');
    if (!sessionId) return;
    const now = new Date().toISOString();
    const existing = JSON.parse(localStorage.getItem('lifeos_users') ?? '[]') as Array<{ id: string; [key: string]: unknown }>;
    const filtered = existing.filter((u) => u.id !== sessionId);
    filtered.push({
      id: sessionId,
      email: 'lifeos-e2e-test@example.com',
      passwordHash: 'supabase',
      passwordSalt: 'supabase',
      name: 'E2E Test User',
      onboardingStage: 100,
      installDate: now,
      createdAt: now,
      updatedAt: now,
    });
    localStorage.setItem('lifeos_users', JSON.stringify(filtered));
  });

  // Reload so the route guard re-evaluates with onboardingStage=100. After
  // this the URL should resolve to (tabs), not day1-vision.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Save the authenticated storage state
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
