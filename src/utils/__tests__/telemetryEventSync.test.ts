/**
 * Guards the one failure mode that's invisible until prod: a goal_* event added
 * to the client EVENTS map but NOT to the Worker's ALLOWED_EVENTS list 400s
 * server-side. We assert by text (no module imports, so no RN/Cloudflare deps)
 * that every `goal_*` event string declared on the client also appears in the
 * Worker's telemetry allowlist.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..'); // src/utils/__tests__ -> repo root
const clientSrc = fs.readFileSync(path.join(root, 'src/utils/telemetry.ts'), 'utf8');
const workerSrc = fs.readFileSync(path.join(root, 'workers/ai-proxy/src/routes/telemetry.ts'), 'utf8');

// Every 'goal_*' string literal declared in the client EVENTS map.
const goalEvents = [...new Set([...clientSrc.matchAll(/'(goal_[a-z_]+)'/g)].map((m) => m[1]))];

describe('goal telemetry events stay in sync with the worker allowlist', () => {
  it('finds the goal events on the client (sanity)', () => {
    expect(goalEvents).toContain('goal_completed');
    expect(goalEvents.length).toBeGreaterThanOrEqual(9);
  });

  it.each(goalEvents)('worker ALLOWED_EVENTS includes %s', (evt) => {
    expect(workerSrc).toContain(`'${evt}'`);
  });
});

// W3 Today recomposition (01-today-hero.md Acceptance #13): the NextMoveHero
// events exist as literals on the client AND on the Worker allowlist — the
// Worker deploys before any cohort flip, so a missing entry 400s silently.
describe('next-move telemetry events stay in sync with the worker allowlist', () => {
  it.each(['next_move_shown', 'next_move_completed'])(
    'client EVENTS declares the literal %s',
    (evt) => {
      expect(clientSrc).toContain(`'${evt}'`);
    },
  );

  it.each(['next_move_shown', 'next_move_completed'])(
    'worker ALLOWED_EVENTS includes %s',
    (evt) => {
      expect(workerSrc).toContain(`'${evt}'`);
    },
  );
});
