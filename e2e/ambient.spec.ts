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

    // Mesh should have rendered content. On web the mesh is a single div
    // whose backgroundImage stacks multiple radial-gradients (see
    // src/components/shared/ambient/GradientMesh.tsx: WebGradientMesh). On
    // native, three separate orb divs render. Assert the web semantic
    // since this runner is always Chromium.
    const gradientDiv = mesh.locator('div').filter({
      has: page.locator(':scope'),
    }).first();
    await expect(gradientDiv).toBeVisible();
    const meshChildCount = await mesh.locator('div').count();
    expect(meshChildCount).toBeGreaterThanOrEqual(1);

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

    // On web, ambient "orbs" are CSS radial-gradients on a single div, not
    // separate orb elements (see GradientMesh.tsx → WebGradientMesh). Count
    // divs whose backgroundImage actually contains at least one
    // radial-gradient — that's the web equivalent of "the mesh rendered".
    const ambientLayers = await page.evaluate(() => {
      const bg = document.querySelector('[data-testid="aurora-bg"]');
      if (!bg) return { found: false, gradientLayers: 0, totalGradients: 0 };
      const allDivs = bg.querySelectorAll('div');
      let gradientLayers = 0;
      let totalGradients = 0;
      for (const el of Array.from(allDivs)) {
        const bi = getComputedStyle(el).backgroundImage;
        if (bi && bi.includes('radial-gradient')) {
          gradientLayers++;
          totalGradients += (bi.match(/radial-gradient/g) ?? []).length;
        }
      }
      return { found: true, gradientLayers, totalGradients };
    });

    expect(ambientLayers.found).toBe(true);
    // At least one div carries the mesh gradient(s), and the mesh stacks
    // ≥3 radial-gradient functions (one per preset stop — DEFAULT_MESH_STOPS
    // in AuroraBackground.tsx defines exactly 3).
    expect(ambientLayers.gradientLayers).toBeGreaterThanOrEqual(1);
    expect(ambientLayers.totalGradients).toBeGreaterThanOrEqual(3);
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
