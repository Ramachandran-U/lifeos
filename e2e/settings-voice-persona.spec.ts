/**
 * Settings → Voice persona picker E2E (mock user).
 *
 * Covers the shipped persona system: Settings renders the VoicePersonaPicker,
 * selecting a persona checks it (radio a11y) and writes `preferredVoiceId` onto
 * the user row (which both VoiceCompanion and the spoken onboarding read).
 *
 * No AI mock needed — this is pure UI + localStorage. We assert the write
 * in-session rather than across a reload: `seedAuthedUser` uses addInitScript,
 * which re-seeds `lifeos_users` on every navigation and would overwrite the
 * just-written value on reload.
 */
import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Settings → Voice persona picker', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('selecting a persona persists preferredVoiceId on the user row', async ({ page }) => {
    await page.goto('/settings');

    // The Voice section renders the picker.
    await expect(page.getByText('Voice', { exact: true })).toBeVisible({ timeout: 15_000 });

    const readVoiceId = () =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('lifeos_users') ?? '[]')[0]?.preferredVoiceId ?? null;
        } catch {
          return null;
        }
      });

    // Default persona (Max) — no explicit preferredVoiceId set yet.
    expect(await readVoiceId()).toBeNull();

    // Pick a different persona (Sol). Match by leading name to avoid coupling to
    // the blurb separator/punctuation. (RN-web doesn't surface aria-checked for
    // role=radio, so we assert the persisted outcome, not the attribute.)
    const sol = page.getByRole('radio', { name: /^Sol\b/ });
    await expect(sol).toBeVisible();
    await sol.click();

    // It persisted to the user row (in-session — addInitScript re-seeds on reload).
    await expect.poll(readVoiceId).toBe('sol');
  });

  test('each persona row exposes a preview affordance', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Voice', { exact: true })).toBeVisible({ timeout: 15_000 });
    // A "Hear <name>" button per persona (not tapped — it opens a live audio
    // session; we just assert the affordance is wired).
    await expect(page.getByRole('button', { name: /Hear Sol/ })).toBeVisible();
  });
});
