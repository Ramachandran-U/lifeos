import { test, expect } from '@playwright/test';

// Ambient background E2E tests — requires authenticated session.
// Run: SMOKE_BASE_URL=https://... npx playwright test --project=authenticated -g ambient

test.describe('ambient backgrounds', () => {
  test('Today screen renders ambient layers', async ({ page }) => {
    const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // The aurora background container should be present
    const auroraBg = page.locator('[data-testid="aurora-bg"]');
    await expect(auroraBg).toBeVisible({ timeout: 10000 });

    // The gradient mesh layer should render (always on)
    const mesh = page.locator('[data-testid="ambient-mesh"]');
    await expect(mesh).toBeVisible();

    // Mesh should have child elements (the orbiting gradient orbs)
    const meshChildren = mesh.locator('div');
    const meshChildCount = await meshChildren.count();
    expect(meshChildCount).toBeGreaterThanOrEqual(3);

    // The sweep container should be present (even if not active)
    const sweep = page.locator('[data-testid="ambient-sweep"]');
    await expect(sweep).toBeVisible();

    // Screenshot the Today screen with ambient
    await page.screenshot({
      path: 'smoke-output/ambient-today-authenticated.png',
      fullPage: false,
    });
  });

  test('ambient layers have animated children (not empty)', async ({ page }) => {
    const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Count all absolutely-positioned divs inside aurora-bg (ambient layer orbs)
    const ambientOrbs = await page.evaluate(() => {
      const bg = document.querySelector('[data-testid="aurora-bg"]');
      if (!bg) return { found: false, orbCount: 0 };
      const allDivs = bg.querySelectorAll('div');
      let orbCount = 0;
      for (const el of Array.from(allDivs)) {
        const cs = getComputedStyle(el);
        if (cs.position === 'absolute' && cs.borderRadius && cs.borderRadius !== '0px') {
          orbCount++;
        }
      }
      return { found: true, orbCount };
    });

    expect(ambientOrbs.found).toBe(true);
    // At minimum: 3 mesh orbs. With time-of-day blooms on native: +2-3 more.
    // On web, blooms are CSS gradients not div orbs, so mesh orbs alone = 3.
    expect(ambientOrbs.orbCount).toBeGreaterThanOrEqual(3);
  });

  test('time-of-day web gradient contains expected colors', async ({ page }) => {
    const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const bgInfo = await page.evaluate(() => {
      const bg = document.querySelector('[data-testid="aurora-bg"]');
      if (!bg) return { found: false, gradient: '' };
      // Find the div with backgroundImage (web gradient layer)
      const allDivs = bg.querySelectorAll('div');
      for (const el of Array.from(allDivs)) {
        const bi = (el as HTMLElement).style.backgroundImage;
        if (bi && bi.includes('radial-gradient')) {
          return { found: true, gradient: bi.substring(0, 300) };
        }
      }
      return { found: false, gradient: '' };
    });

    expect(bgInfo.found).toBe(true);
    // Should contain violet (165,132,255) which is present in all presets
    expect(bgInfo.gradient).toContain('165');
    expect(bgInfo.gradient).toContain('132');
    expect(bgInfo.gradient).toContain('255');
  });

  test('screenshots ambient at different scroll positions', async ({ page }) => {
    const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081';
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: 'smoke-output/ambient-top.png',
      fullPage: false,
    });

    // Scroll down to test parallax
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'smoke-output/ambient-scrolled.png',
      fullPage: false,
    });
  });
});
