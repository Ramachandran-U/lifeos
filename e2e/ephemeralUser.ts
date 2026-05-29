/**
 * Ephemeral Supabase test users — created at the start of a test, deleted
 * at the end. Use this when the test needs to assert behavior for a user
 * the persistent test user has already passed through (most importantly:
 * the fresh-onboarding flow, which only happens once per user).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL in the
 * environment of the Playwright runner. The service-role key never reaches
 * the browser — it's only used Node-side to call the admin API.
 *
 * Usage:
 *   test('fresh user routes to onboarding', async ({ page }) => {
 *     const user = await createEphemeralUser();
 *     try {
 *       // ... sign in with user.email / user.password ...
 *     } finally {
 *       await user.cleanup();
 *     }
 *   });
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface EphemeralUser {
  email: string;
  password: string;
  userId: string;
  cleanup: () => Promise<void>;
}

function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Ephemeral users require SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL.\n' +
        'Set both in your shell, then re-run. The service-role key is admin-grade — never commit it.',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createEphemeralUser(): Promise<EphemeralUser> {
  const admin = adminClient();
  // Random suffix avoids races between parallel specs and survives a crashed
  // test run that didn't call cleanup() — a sweeper job (not implemented yet)
  // can recognise the `e2e-` prefix.
  const id = randomUUID().slice(0, 8);
  const email = `e2e-${id}@lifeos.test`;
  const password = `Ephemeral-${id}-${Date.now()}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `E2E Ephemeral ${id}` },
  });
  if (error || !data.user) {
    throw new Error(`createEphemeralUser failed: ${error?.message ?? 'unknown'}`);
  }

  return {
    email,
    password,
    userId: data.user.id,
    cleanup: async () => {
      try {
        await admin.auth.admin.deleteUser(data.user!.id);
      } catch {
        // Best effort — if Supabase is flaking we don't want to mask the
        // real test failure. The next sweeper run (or manual cleanup) picks
        // up any leftovers by email prefix.
      }
    },
  };
}
