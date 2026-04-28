import { create } from 'zustand';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const STALE_MS = 5 * 60 * 1000;

interface PromptEntry {
  body: string;
  version: number;
}

interface PromptState {
  prompts: Record<string, PromptEntry>;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  fetchPrompts: () => Promise<void>;
  getPrompt: (key: string, fallback: string) => string;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: {},
  fetchedAt: null,
  loading: false,
  error: null,

  fetchPrompts: async () => {
    if (!PROXY_URL) return;
    const fetchedAt = get().fetchedAt;
    if (fetchedAt && Date.now() - fetchedAt < STALE_MS) return;

    set({ loading: true, error: null });
    try {
      const token = await getSupabaseAccessToken();
      if (!token) {
        set({ loading: false });
        return;
      }
      const res = await fetch(`${PROXY_URL}/v1/prompts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`prompts ${res.status}`);
      const json = (await res.json()) as { prompts: Record<string, PromptEntry> };
      set({ prompts: json.prompts, fetchedAt: Date.now(), loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'prompt fetch failed', loading: false });
    }
  },

  getPrompt: (key, fallback) => get().prompts[key]?.body ?? fallback,
}));
