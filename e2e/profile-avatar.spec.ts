/**
 * Profile avatar generation E2E (mock mode).
 *
 * Exercises the full Phase-4 flow in a real browser: open the avatar sheet,
 * pick a photo via the file chooser, run "Generate" (mock echoes the source),
 * save, and assert the avatar URI was persisted to the local user row.
 *
 * Requires the web dev server to be started with the feature flag + mock on:
 *   EXPO_PUBLIC_FLAG_PROFILE_AVATAR_GEN=true EXPO_PUBLIC_USE_AI_MOCK=true
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { seedAuthedUser } from './helpers';

// Allow pointing at an alternate dev-server port (default config uses 8081).
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Profile avatar — generate & save (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('open sheet → pick photo → generate → save → persisted', async ({ page }) => {
    await page.goto('/profile');

    // Header hydrates — the USAGE card is a stable anchor.
    await expect(page.getByText('USAGE', { exact: true })).toBeVisible();

    // The avatar affordance only exists when profileAvatarGen is compiled in
    // (EXPO_PUBLIC_FLAG_PROFILE_AVATAR_GEN=true at bundle time). When the flag is
    // off — e.g. a default CI e2e run — skip instead of failing, since the
    // feature is intentionally absent from the bundle.
    const editAvatar = page.getByRole('button', { name: 'Edit profile avatar' });
    test.skip(
      (await editAvatar.count()) === 0,
      'profileAvatarGen flag not enabled in this build — start the web server with EXPO_PUBLIC_FLAG_PROFILE_AVATAR_GEN=true',
    );
    // The generate step makes an AI call; without mock mode the "Use this avatar"
    // result never appears. Skip rather than fail when mock mode is off.
    const isMock = await page.evaluate(() => !!(window as { __AI_MOCK?: boolean }).__AI_MOCK);
    test.skip(!isMock, 'AI mock mode not enabled — start the server with EXPO_PUBLIC_USE_AI_MOCK=true');
    await expect(editAvatar).toBeVisible();
    await editAvatar.click();

    // Sheet opens with the source-choice actions.
    await expect(page.getByText('Profile avatar', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose from library' })).toBeVisible();

    // Pick a file via the chooser expo-image-picker triggers on web.
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose from library' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(path.join(__dirname, '..', 'assets', 'icon.png'));

    // Preview → Generate (mock echoes the source image).
    const generate = page.getByRole('button', { name: 'Generate avatar' });
    await expect(generate).toBeVisible();
    await generate.click();

    // Result → save.
    const save = page.getByRole('button', { name: 'Use this avatar' });
    await expect(save).toBeVisible({ timeout: 15_000 });
    await save.click();

    // The generated avatar URI is persisted to the local user row. On web that
    // is an inline data: URI (no filesystem), written via webUpdateUser.
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          try {
            const users = JSON.parse(localStorage.getItem('lifeos_users') || '[]');
            return users[0]?.avatarUri ?? null;
          } catch {
            return null;
          }
        });
      }, { timeout: 10_000 })
      .toContain('data:image');
  });
});
