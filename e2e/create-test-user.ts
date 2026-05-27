#!/usr/bin/env npx ts-node
// Creates a persistent test user in Supabase for Playwright E2E tests.
// Run once: npx ts-node e2e/create-test-user.ts
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in environment.
// The service role key has admin access — never commit it.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'lifeos-e2e-test@example.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'LifeOS-E2E-Test-2026!';
const TEST_NAME = 'E2E Test User';

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Required env vars: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === TEST_EMAIL);

  if (found) {
    console.log(`Test user already exists: ${found.id} (${TEST_EMAIL})`);
    console.log('To reset password, delete and re-run this script.');
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name: TEST_NAME },
  });

  if (error) {
    console.error('Failed to create test user:', error.message);
    process.exit(1);
  }

  console.log(`Test user created: ${data.user.id}`);
  console.log(`  Email: ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log('');
  console.log('Add to .env.test:');
  console.log(`  PLAYWRIGHT_TEST_EMAIL=${TEST_EMAIL}`);
  console.log(`  PLAYWRIGHT_TEST_PASSWORD=${TEST_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
