/**
 * LifeOS deploy smoke. Visits every canonical route, fails on console.error /
 * pageerror, asserts a route-specific selector renders, captures a screenshot.
 *
 * Run against a deploy preview URL:
 *   SMOKE_BASE_URL=https://<hash>.lifeos-6r5-eqa.pages.dev npx playwright test \
 *     --project=smoke
 *
 * Run locally against expo web:
 *   npm run web   (in another shell)
 *   npx playwright test --project=smoke
 */
import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { seedAuthedUser } from './helpers';

interface RouteSpec {
  path: string;
  name: string;
  selector: string;
  comment?: string;
}

interface NavSpec {
  name: string;
  from: string;
  click: string;
  expectPath: string;
  comment?: string;
}

interface RoutesFile {
  routes: RouteSpec[];
  navigation: NavSpec[];
  ignoredConsolePatterns: string[];
}

const routesFile: RoutesFile = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'routes.json'), 'utf8'),
);

const SCREENSHOT_DIR = path.join(__dirname, '..', 'smoke-output');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'report.json');

// Reset the output dir once per run.
test.beforeAll(() => {
  fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ routes: [], navigation: [] }, null, 2));
});

interface RouteResult {
  name: string;
  path: string;
  status: 'pass' | 'fail';
  errors: string[];
  durationMs: number;
  screenshot: string;
}

interface NavResult {
  name: string;
  status: 'pass' | 'fail';
  errors: string[];
}

function appendRouteResult(r: RouteResult) {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  report.routes.push(r);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function appendNavResult(r: NavResult) {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  report.navigation.push(r);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function isIgnoredConsole(msg: ConsoleMessage, ignored: string[]): boolean {
  const text = msg.text();
  return ignored.some((p) => text.includes(p));
}

interface CapturedErrors {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

function attachListeners(page: Page, ignored: string[]): CapturedErrors {
  const captured: CapturedErrors = { consoleErrors: [], pageErrors: [], failedRequests: [] };

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (isIgnoredConsole(msg, ignored)) return;
    captured.consoleErrors.push(msg.text());
  });

  page.on('pageerror', (err) => {
    captured.pageErrors.push(`${err.name}: ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    // App-bundle / chunk request failures are catastrophic.
    const url = req.url();
    const status = req.failure()?.errorText ?? 'unknown';
    if (url.includes('/_expo/') || url.endsWith('.js') || url.endsWith('.css')) {
      captured.failedRequests.push(`${url} → ${status}`);
    }
  });

  return captured;
}

// ─── Route render checks ─────────────────────────────────────────────────────

for (const route of routesFile.routes) {
  test(`route: ${route.name}`, async ({ page }) => {
    const start = Date.now();
    await seedAuthedUser(page);

    const captured = attachListeners(page, routesFile.ignoredConsolePatterns);

    let response;
    try {
      response = await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      captured.pageErrors.push(`navigation error: ${msg}`);
    }

    // Route-specific render proof. Generous timeout — the SPA may hydrate slowly.
    let selectorFound = false;
    try {
      await page.locator(route.selector).first().waitFor({ state: 'visible', timeout: 8_000 });
      selectorFound = true;
    } catch {
      captured.pageErrors.push(`selector not found: ${route.selector}`);
    }

    const screenshotName = `${route.name}.png`;
    const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const errors: string[] = [
      ...captured.consoleErrors.map((e) => `console.error: ${e}`),
      ...captured.pageErrors.map((e) => `pageerror: ${e}`),
      ...captured.failedRequests.map((e) => `requestfailed: ${e}`),
    ];
    if (response && response.status() >= 400) {
      errors.unshift(`HTTP ${response.status()} on ${route.path}`);
    }

    const result: RouteResult = {
      name: route.name,
      path: route.path,
      status: errors.length === 0 && selectorFound ? 'pass' : 'fail',
      errors,
      durationMs: Date.now() - start,
      screenshot: screenshotName,
    };
    appendRouteResult(result);

    expect(errors, `Route "${route.name}" failed:\n${errors.join('\n')}`).toEqual([]);
    expect(selectorFound, `Selector "${route.selector}" never appeared on ${route.path}`).toBe(true);
  });
}

// ─── Navigation transition checks ────────────────────────────────────────────

for (const nav of routesFile.navigation) {
  test(`nav: ${nav.name}`, async ({ page }) => {
    await seedAuthedUser(page);
    const captured = attachListeners(page, routesFile.ignoredConsolePatterns);

    await page.goto(nav.from, { waitUntil: 'networkidle', timeout: 30_000 });
    // Wait for the clickable target to exist before scrolling/clicking. Routes
    // like Privacy & data residency sit below the fold on small viewports,
    // and the SETTINGS card may not render until preferences/theme stores
    // have hydrated.
    const target = page.locator(nav.click).first();
    await target.waitFor({ state: 'visible', timeout: 10_000 });
    await target.scrollIntoViewIfNeeded();
    await target.click();
    // Give SPA router a beat to commit.
    await page.waitForTimeout(800);

    const currentUrl = page.url();
    const matched = currentUrl.includes(nav.expectPath);

    const errors: string[] = [
      ...captured.consoleErrors.map((e) => `console.error: ${e}`),
      ...captured.pageErrors.map((e) => `pageerror: ${e}`),
    ];
    if (!matched) errors.push(`expected URL to contain "${nav.expectPath}", got "${currentUrl}"`);

    appendNavResult({
      name: nav.name,
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
    });

    expect(errors, `Navigation "${nav.name}" failed:\n${errors.join('\n')}`).toEqual([]);
  });
}
