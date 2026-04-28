import { pgSelect, pgInsert, type SupabaseEnv } from './supabase';

export interface AdminClaims {
  email: string;
  role: 'owner' | 'editor' | 'support';
}

interface AdminRow {
  email: string;
  role: 'owner' | 'editor' | 'support';
}

export async function requireAdmin(
  env: SupabaseEnv,
  jwtClaims: { email?: string },
): Promise<AdminClaims> {
  const email = (jwtClaims.email || '').toLowerCase().trim();
  if (!email) throw new Error('admin: missing email claim');
  const rows = await pgSelect<AdminRow>(
    env,
    'admins',
    `email=eq.${encodeURIComponent(email)}&select=email,role`,
  );
  if (rows.length === 0) throw new Error('admin: not authorized');
  return { email: rows[0].email, role: rows[0].role };
}

export async function writeAudit(
  env: SupabaseEnv,
  actor: string,
  action: string,
  targetType: string,
  targetId: string | null,
  before: unknown,
  after: unknown,
): Promise<void> {
  await pgInsert(env, 'audit_log', {
    actor_email: actor,
    action,
    target_type: targetType,
    target_id: targetId,
    before,
    after,
  }).catch((e) => console.error('audit_log write failed:', e));
}
