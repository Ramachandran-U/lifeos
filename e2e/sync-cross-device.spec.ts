/**
 * Cross-device sync — first end-to-end proof of the P1 sync engine [B-P1].
 *
 * Two browser contexts sign in as the SAME persistent test user (the
 * `authenticated` project storageState) but are given DISTINCT device ids — i.e.
 * the same account on two devices. A mutation made on device A must appear on
 * device B after a sync round-trip.
 *
 * The Worker transport is MOCKED at the network boundary (page.route) so the test
 * is deterministic and needs no live proxy: device A's push is captured into a
 * shared in-memory log, and device B's pull is served from it — exercising the
 * real client loop (recordMutation → outbox → push → pull → reducer → local
 * store) which unit tests can't reach. /v1/config is also mocked to force the
 * sync flags on (the CI e2e build has no proxy URL, so the real fetch would fall
 * back to sync_engine_enabled:false).
 *
 * Runs under the `authenticated` project (real Supabase session → a real bearer
 * for the push/pull gate; the project is non-blocking in CI, so a flake here can
 * never red a merge). Skips cleanly when the test-user secrets aren't configured.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import path from 'path';
import { captureErrors } from './helpers';
import { seedFixtureForSession } from './seedTestUser';

const AUTH_STORAGE = path.join(__dirname, '..', '.auth', 'user.json');
const TASK_ID = 'e2e-task-read'; // a seeded daily task (see seedTestUser.ts)

interface ServerRow {
  seq: number;
  record: Record<string, unknown>;
}

// FIXME (B-P1): the design below is complete, but it can't run green in the
// current CI e2e build yet. Root cause confirmed from the first CI run: the
// build sets no EXPO_PUBLIC_AI_PROXY_URL, so useFlagStore SHORT-CIRCUITS and
// never fetches /v1/config — which means the mocked /v1/config below is never
// hit, sync_engine_enabled stays false (its FALLBACK default), the engine
// no-ops, and device A never pushes (serverLog stays empty). To enable: set a
// non-empty EXPO_PUBLIC_AI_PROXY_URL in .github/workflows/e2e.yml's web:export
// build (any value — the mocked /v1/config + /v1/sync routes intercept it) so
// fetchFlags actually calls /v1/config; then verify the live session token and
// the reload-driven drain timing on a real CI run. Kept as test.fixme so the
// (locally-unrunnable — see the web SSR blocker) design is captured without
// reding the suite. Flip to `test` once the build env lands.
test.describe('Cross-device sync [B-P1]', () => {
  test.fixme('a goal completed on device A syncs to device B', async ({ browser }) => {
    // The shared mock "server": the mutation log the two devices push/pull through.
    const serverLog: ServerRow[] = [];
    let seq = 0;

    const setupDevice = async (ctx: BrowserContext, deviceId: string): Promise<void> => {
      // Distinct device id BEFORE boot (getDeviceId memoizes from this localStorage
      // key). Without distinct ids, B would skip A's mutation as its "own".
      await ctx.addInitScript((id) => {
        localStorage.setItem('lifeos_telemetry_device_id', id);
      }, deviceId);

      // Force both sync flags on (the CI build's /v1/config fetch otherwise falls
      // back to sync_engine_enabled:false → the engine no-ops entirely).
      await ctx.route('**/v1/config**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            flags: { sync_engine_enabled: true, mutation_log_enabled: true },
            fetched_at: new Date().toISOString(),
          }),
        }));

      // push: capture each mutation, assign a gap-free seq, ack every id.
      await ctx.route('**/v1/sync/push', async (route) => {
        const body = (route.request().postDataJSON() ?? {}) as { mutations?: Record<string, unknown>[] };
        const acked: string[] = [];
        for (const m of body.mutations ?? []) {
          seq += 1;
          serverLog.push({ seq, record: m });
          acked.push(String(m.id));
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ acked }) });
      });

      // pull: serve everything after the caller's cursor, advance the cursor.
      await ctx.route('**/v1/sync/pull**', async (route) => {
        const since = Number(new URL(route.request().url()).searchParams.get('since') ?? '0') || 0;
        const rows = serverLog.filter((e) => e.seq > since);
        const cursor = rows.length ? rows[rows.length - 1]!.seq : since;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mutations: rows.map((r) => r.record), cursor }),
        });
      });
    };

    const ctxA = await browser.newContext({ storageState: AUTH_STORAGE });
    const ctxB = await browser.newContext({ storageState: AUTH_STORAGE });
    await setupDevice(ctxA, 'e2e-device-A');
    await setupDevice(ctxB, 'e2e-device-B');

    try {
      // ── Device A: boot, seed the daily task, complete it, push. ──
      const pageA = await ctxA.newPage();
      const errA = captureErrors(pageA);
      await pageA.goto('/', { waitUntil: 'domcontentloaded' });
      await pageA.waitForTimeout(1500);
      await seedFixtureForSession(pageA, 'fullyLoaded');
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await pageA.waitForTimeout(1500);

      await pageA.goto('/(tabs)/goals', { waitUntil: 'domcontentloaded' });
      await expect(pageA.getByText("Today's Tasks")).toBeVisible({ timeout: 15_000 });
      const task = pageA.getByText('Read 20 pages');
      await expect(task).toBeVisible();
      await task.click(); // updateGoalStatus → recordMutation → outbox
      await expect(pageA.getByText('Read 20 pages')).toHaveCount(0, { timeout: 8_000 });

      // Reload to trigger a boot drain → pushPending → mock /v1/sync/push.
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => serverLog.length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(errA.pageErrors, `device A threw:\n${errA.pageErrors.join('\n')}`).toEqual([]);

      // ── Device B: same account, different device. Boot → pull → apply. ──
      const pageB = await ctxB.newPage();
      const errB = captureErrors(pageB);
      await pageB.goto('/', { waitUntil: 'domcontentloaded' });
      await pageB.waitForTimeout(1500);
      await seedFixtureForSession(pageB, 'fullyLoaded'); // starts the task 'active'
      await pageB.reload({ waitUntil: 'domcontentloaded' }); // boot drain → pull → reducer applies
      await pageB.waitForTimeout(2000);

      // B's local goal now reflects the completion synced from A.
      await expect
        .poll(async () =>
          pageB.evaluate((id) => {
            try {
              const goals = JSON.parse(localStorage.getItem('lifeos_goals') || '[]') as Array<{ id: string; status?: string }>;
              return goals.find((g) => g.id === id)?.status ?? null;
            } catch {
              return null;
            }
          }, TASK_ID), { timeout: 20_000 })
        .toBe('completed');
      expect(errB.pageErrors, `device B threw:\n${errB.pageErrors.join('\n')}`).toEqual([]);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
