/**
 * Time-boxed auth-session read for app boot.
 *
 * `app/_layout.tsx` renders NOTHING until its `dbReady` flag flips, so anything
 * that can hang during init is a blank screen for the user — not a spinner, not
 * an error message. When the Supabase host stopped resolving, `getSession()`
 * sat there until the network layer gave up, and the whole app looked broken.
 *
 * Reading the session is an optimisation: it rehydrates the local user row from
 * a persisted session. The app is fully usable signed-out, and the local-first
 * stores hold the user's real data regardless. So the read gets a deadline, and
 * a miss is treated as "no session" rather than a reason to hold the door shut.
 *
 * Lives here rather than in `_layout.tsx` so it is unit-testable: a `.test.tsx`
 * under `app/` is matched by neither jest project (see
 * `src/utils/__tests__/testDiscoveryCompliance.test.ts`).
 */

/** How long boot will wait for the auth backend before proceeding without it. */
export const AUTH_BOOT_TIMEOUT_MS = 3_000;

/**
 * Race a session read against a deadline.
 *
 * Returns the reader's result if it settles in time, or `null` on timeout or
 * rejection. `null` means "carry on without a session" — never "retry" and
 * never "block".
 *
 * @param read     the session reader (normally `supabase.auth.getSession`)
 * @param timeoutMs deadline; defaults to {@link AUTH_BOOT_TIMEOUT_MS}
 */
export async function withAuthDeadline<T>(
  read: () => Promise<T>,
  timeoutMs: number = AUTH_BOOT_TIMEOUT_MS,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T | null>([
      read(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    // An unreachable or misconfigured backend boots the app signed-out rather
    // than not at all.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
