#!/usr/bin/env npx ts-node
/**
 * Sweep leaked ephemeral E2E users from Supabase.
 *
 * `e2e/ephemeralUser.ts` creates throwaway accounts (`e2e-<id>@lifeos.test`) and
 * deletes them in a test's `finally`. A crashed/killed run skips that cleanup and
 * leaks the account. This is the "sweeper job (not implemented yet)" its comment
 * referenced: it deletes ephemeral users older than a cutoff (default 2h, so it
 * never races a currently-running spec). Run from the e2e CI job's always()
 * post-step, or manually:  npx ts-node e2e/sweep-ephemeral.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + (SUPABASE_URL | EXPO_PUBLIC_SUPABASE_URL).
 * The service-role key is admin-grade — never commit it, never expose to the app.
 *
 * SAFETY: only touches addresses matching `e2e-*@lifeos.test`. The persistent
 * test user (lifeos-e2e-test@example.com) does NOT match and is never deleted.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const CUTOFF_HOURS = Number(process.env.E2E_SWEEP_CUTOFF_HOURS ?? '2');

function isEphemeral(email: string | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e.startsWith('e2e-') && e.endsWith('@lifeos.test');
}

function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'sweep-ephemeral requires SUPABASE_SERVICE_ROLE_KEY + (SUPABASE_URL | EXPO_PUBLIC_SUPABASE_URL).',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function main(): Promise<void> {
  const admin = adminClient();
  const cutoffMs = Date.now() - CUTOFF_HOURS * 3_600_000;
  let page = 1;
  let scanned = 0;
  let deleted = 0;
  const failures: string[] = [];

  // listUsers is paginated (default 50/page). Walk every page so old leaks on
  // later pages aren't missed.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers page ${page} failed: ${error.message}`);
    const users = data?.users ?? [];
    if (users.length === 0) break;
    scanned += users.length;

    for (const u of users) {
      if (!isEphemeral(u.email)) continue;
      const createdMs = u.created_at ? new Date(u.created_at).getTime() : 0;
      if (createdMs > cutoffMs) continue; // too recent — may be an in-flight run
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) failures.push(`${u.email}: ${delErr.message}`);
      else deleted += 1;
    }

    if (users.length < 200) break;
    page += 1;
  }

  console.log(`sweep-ephemeral: scanned ${scanned} users, deleted ${deleted} ephemeral (older than ${CUTOFF_HOURS}h).`);
  if (failures.length > 0) {
    // Don't fail the CI job over a best-effort cleanup — just report.
    console.warn(`sweep-ephemeral: ${failures.length} deletion(s) failed:\n${failures.join('\n')}`);
  }
}

main().catch((e) => {
  console.error('sweep-ephemeral error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
