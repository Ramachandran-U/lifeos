import { browserClient } from './supabase';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL!;

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const supabase = browserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not signed in');
  return fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export interface Flag {
  id: string;
  key: string;
  type: 'bool' | 'cohort_pct' | 'enum';
  default_value: unknown;
  status: 'active' | 'killed';
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export async function listFlags(): Promise<Flag[]> {
  const res = await authedFetch('/v1/admin/flags');
  if (!res.ok) throw new Error(`flags: ${res.status}`);
  const json = await res.json();
  return json.flags;
}

export async function patchFlag(
  key: string,
  patch: Partial<Pick<Flag, 'default_value' | 'status' | 'description'>>,
): Promise<Flag> {
  const res = await authedFetch(`/v1/admin/flags/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch flag: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.flag;
}

export interface Prompt {
  id: string;
  key: string;
  description: string | null;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  body: string;
  status: 'draft' | 'active' | 'archived';
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export async function listPrompts(): Promise<Prompt[]> {
  const res = await authedFetch('/v1/admin/prompts');
  if (!res.ok) throw new Error(`prompts: ${res.status}`);
  const json = await res.json();
  return json.prompts;
}

export async function getPrompt(key: string): Promise<{ prompt: Prompt; versions: PromptVersion[] }> {
  const res = await authedFetch(`/v1/admin/prompts/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`prompt: ${res.status}`);
  return res.json();
}

export async function createPromptVersion(
  key: string,
  body: string,
  notes?: string,
): Promise<PromptVersion> {
  const res = await authedFetch(`/v1/admin/prompts/${encodeURIComponent(key)}/versions`, {
    method: 'POST',
    body: JSON.stringify({ body, notes }),
  });
  if (!res.ok) throw new Error(`create version: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.version;
}

export async function activatePromptVersion(key: string, version: number): Promise<PromptVersion> {
  const res = await authedFetch(
    `/v1/admin/prompts/${encodeURIComponent(key)}/versions/${version}/activate`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(`activate: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.version;
}
