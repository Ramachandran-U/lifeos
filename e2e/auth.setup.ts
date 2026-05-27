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

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Navigate to sign-in if not already there
  const signInLink = page.getByText('Sign in');
  if (await signInLink.isVisible()) {
    await signInLink.click();
    await page.waitForTimeout(1000);
  }

  // Fill credentials
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for auth to complete — either the Today tab loads or onboarding appears
  await expect(
    page.locator('[data-testid="aurora-bg"], [data-testid="today-screen"]').first()
  ).toBeVisible({ timeout: 15000 });

  // Save the authenticated storage state
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
