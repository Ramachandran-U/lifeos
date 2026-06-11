import { test, expect } from '@playwright/test';
import { seedAuthedUser, type SeedBlock } from './helpers';

// Ink canvas E2E (Ink + Signal, Cluster 3 §B) — the wash is dead; the resting
// base is true-black ink with nothing moving, and ambient layers are EVENT
// language only. Self-seeding (chromium project): no real session required.
// Run: npx playwright test --project=chromium -g "ink canvas"

const BLOCK = (id: string, status?: string): SeedBlock => ({
  id,
  startTime: '09:00',
  endTime: '09:45',
  title: `Block ${id}`,
  module: 'health',
  ...(status ? { status } : {}),
});

test.describe('ink canvas', () => {
  test('1. the wash is gone: aurora-bg and ambient-mesh resolve to nothing, ink-canvas renders', async ({ page }) => {
    await seedAuthedUser(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    expect(await page.locator('[data-testid="aurora-bg"]').count()).toBe(0);
    expect(await page.locator('[data-testid="ambient-mesh"]').count()).toBe(0);
    await expect(page.locator('[data-testid="ink-canvas"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('2. ink-canvas is true black with zero gradient imagery', async ({ page }) => {
    await seedAuthedUser(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="ink-canvas"]');
      if (!canvas) return null;
      const bg = getComputedStyle(canvas as HTMLElement).backgroundColor;
      let gradientChildren = 0;
      for (const el of Array.from(canvas.querySelectorAll('*'))) {
        if (getComputedStyle(el as HTMLElement).backgroundImage !== 'none') gradientChildren++;
      }
      return { bg, gradientChildren };
    });

    expect(info).not.toBeNull();
    expect(info!.bg).toBe('rgb(0, 0, 0)');
    expect(info!.gradientChildren).toBe(0);
  });

  test('3. particles are EARNED: absent while blocks are incomplete, present once the day completes', async ({ page }) => {
    // Incomplete day → no particle layer.
    await seedAuthedUser(page, { blocks: [BLOCK('e2e-amb-1'), BLOCK('e2e-amb-2')] });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    expect(await page.locator('[data-testid="ambient-particles"]').count()).toBe(0);

    // All blocks completed → the earned particle state renders.
    await seedAuthedUser(page, {
      blocks: [BLOCK('e2e-amb-1', 'completed'), BLOCK('e2e-amb-2', 'completed')],
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    expect(await page.locator('[data-testid="ambient-particles"]').count()).toBeGreaterThan(0);
  });

  test('4. the sweep container idles present and visually silent', async ({ page }) => {
    await seedAuthedUser(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const sweep = page.locator('[data-testid="ambient-sweep"]').first();
    await expect(sweep).toBeAttached();
    // Idle = the sweep band exists (EnergySweep's frozen behavior keeps it
    // mounted) but renders NOTHING visible: every painted (non-transparent
    // background) descendant has EFFECTIVE opacity 0 — own opacity multiplied
    // up the ancestor chain. "Rest quiet" asserted at the pixel contract.
    const maxPaintedOpacity = await sweep.evaluate((root) => {
      let max = 0;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const style = getComputedStyle(el as HTMLElement);
        const bg = style.backgroundColor;
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
        let effective = 1;
        let node: Element | null = el;
        while (node && node !== root.parentElement) {
          effective *= parseFloat(getComputedStyle(node as HTMLElement).opacity || '1');
          node = node.parentElement;
        }
        max = Math.max(max, effective);
      }
      return max;
    });
    expect(maxPaintedOpacity).toBe(0);
  });
});
