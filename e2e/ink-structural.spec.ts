import { test, expect } from '@playwright/test';
import { seedAuthedUser } from './helpers';

// Structural color E2E (Ink + Signal, Cluster 3 §C + §E) — the R1 block and
// the front door, asserted at the pixel contract. Self-seeding (chromium
// project): no real session required.
// Run: npx playwright test --project=chromium ink-structural
//
// C3-8: every module screen opens on ONE solid full-bleed domain-hue block —
//        the exact token hue, edge to edge, title in inkOnColor.
// C3-9: sign-in is ink — zero backdrop-filter glass, true-black body, violet
//        confined to the brand signature, neutral underlined switch link.

// Mobile viewport — full-bleed means the block spans the whole device width.
test.use({ viewport: { width: 390, height: 844 } });

const VIEWPORT_WIDTH = 390;
const INK_ON_COLOR = 'rgb(11, 11, 13)'; // #0B0B0D
const VIOLET = 'rgb(139, 124, 255)'; // #8B7CFF — dark-mode primary

const MODULE_SCREENS: { route: string; title: string; hue: string }[] = [
  { route: '/goals',   title: 'Goals',   hue: 'rgb(255, 119, 51)' },  // #FF7733
  { route: '/health',  title: 'Health',  hue: 'rgb(0, 214, 143)' },   // #00D68F
  { route: '/finance', title: 'Finance', hue: 'rgb(255, 179, 0)' },   // #FFB300
  { route: '/career',  title: 'Career',  hue: 'rgb(77, 159, 255)' },  // #4D9FFF
  { route: '/social',  title: 'Social',  hue: 'rgb(255, 92, 151)' },  // #FF5C97
  { route: '/explore', title: 'Explore', hue: 'rgb(31, 200, 255)' },  // #1FC8FF
];

test.describe('structural color', () => {
  for (const { route, title, hue } of MODULE_SCREENS) {
    test(`C3-8 ${route}: full-bleed R1 block in the exact domain hue`, async ({ page }) => {
      await seedAuthedUser(page);
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const header = page.locator('[data-testid="module-header"]').first();
      await expect(header).toBeVisible({ timeout: 10000 });

      // The exact token hue — not a tint, not an approximation.
      const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe(hue);

      // Full bleed: edge to edge at the viewport, no horizontal inset.
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.x)).toBe(0);
      expect(Math.round(box!.width)).toBe(VIEWPORT_WIDTH);

      // The title sits ON the hue in inkOnColor.
      const titleColor = await header
        .getByText(title, { exact: true })
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      expect(titleColor).toBe(INK_ON_COLOR);
    });
  }

  test('C3-9 /sign-in: ink front door — no glass, black body, violet confined to the signature', async ({ page }) => {
    await page.goto('/sign-in', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // The glass card is dead: zero backdrop-filter anywhere on the screen.
    const backdropCount = await page.evaluate(() => {
      let n = 0;
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const s = getComputedStyle(el as HTMLElement);
        const bf = s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter;
        if (bf && bf !== 'none') n++;
      }
      return n;
    });
    expect(backdropCount).toBe(0);

    // The resting base is true black.
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(0, 0, 0)');

    // Violet is the brand signature, not decoration: exactly one violet
    // wordmark and one violet CTA, nothing else. Asserted at component
    // granularity — Button3D renders its face and depth edge as two stacked
    // layers of the SAME sanctioned CTA, so violet fills are grouped by their
    // enclosing [role=button]; any violet fill OUTSIDE a button is leakage.
    const violet = await page.evaluate((v) => {
      const text: string[] = [];
      const fillsOutsideCta: string[] = [];
      const ctaButtons = new Set<Element>();
      // Visibility at the pixel contract: paint at effective opacity 0 (own ×
      // ancestor chain) is not on screen — e.g. the EnergySweep band idling
      // silent inside ink-canvas (its event hue only ever SHOWS during a beat).
      const effectiveOpacity = (el: Element): number => {
        let o = 1;
        let n: Element | null = el;
        while (n) {
          o *= parseFloat(getComputedStyle(n as HTMLElement).opacity || '1');
          n = n.parentElement;
        }
        return o;
      };
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const s = getComputedStyle(el as HTMLElement);
        if ((s.color === v || s.backgroundColor === v) && effectiveOpacity(el) === 0) continue;
        if (s.color === v && el.children.length === 0 && (el.textContent ?? '').trim()) {
          text.push((el.textContent ?? '').trim().slice(0, 30));
        }
        if (s.backgroundColor === v) {
          const btn = el.closest('[role="button"]');
          if (btn) ctaButtons.add(btn);
          else fillsOutsideCta.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
        }
      }
      return { text, fillsOutsideCta, ctaCount: ctaButtons.size };
    }, VIOLET);
    expect(violet.text, violet.text.join(' | ')).toEqual(['LifeOS']);
    expect(violet.fillsOutsideCta, violet.fillsOutsideCta.join(' | ')).toHaveLength(0);
    expect(violet.ctaCount).toBe(1);

    // The mode-switch link is neutral ink, underlined — not a violet button.
    const link = page.getByText('Create one', { exact: true }).first();
    await expect(link).toBeVisible();
    const linkStyle = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, decoration: s.textDecorationLine };
    });
    expect(linkStyle.color).toBe('rgb(247, 248, 248)');
    expect(linkStyle.decoration).toContain('underline');
  });
});
