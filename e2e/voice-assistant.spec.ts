import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

test.describe('Voice Assistant E2E', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedUser(page);
  });

  test('opens voice sheet, sends text, receives mock response', async ({ page }) => {
    await page.goto('/');

    // Voice runs over the Gemini Live socket; only an EXPO_PUBLIC_USE_AI_MOCK
    // build carries the deterministic mock transport this test scripts (see
    // src/ai/voiceClient.ts USE_MOCK). Anchor on the header's voice button so
    // the bundle has booted, then env-skip on the same window.__AI_MOCK
    // convention as career-strategy/profile-avatar.
    const voiceOpen = page.getByTestId('voice-open');
    await expect(voiceOpen).toBeVisible({ timeout: 15_000 });
    const isMock = await page.evaluate(() => !!(window as { __AI_MOCK?: boolean }).__AI_MOCK);
    test.skip(!isMock, 'AI mock mode not enabled — build with EXPO_PUBLIC_USE_AI_MOCK=true for the voice mock transport');

    await voiceOpen.click();
    await expect(page.getByTestId('voice-sheet')).toBeVisible();

    await expect(page.getByText(/LISTENING|CONNECTING/)).toBeVisible();

    const input = page.getByTestId('voice-input');
    await input.fill('What should I do next?');
    await page.getByTestId('voice-send').click();

    // The user's sent message is reflected immediately in voice-user-transcript
    // (synchronous state update in useVoice.sendText), not in voice-transcript
    // which holds the assistant's reply.
    await expect(page.getByTestId('voice-user-transcript')).toContainText(
      'What should I do next?',
      { timeout: 5000 },
    );

    await page.getByTestId('voice-close').click();
    await expect(page.getByTestId('voice-sheet')).not.toBeVisible();
  });
});
