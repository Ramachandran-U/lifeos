/**
 * Expedition generation (Explore v2). Turns a seed (interest / spark / free
 * theme) into a finite 5-7 step journey. AI-generated with hard structural
 * guards (step count, concrete self-contained steps, no reflect-filler) and a
 * curated mock fallback so a "start expedition" tap never dead-ends.
 *
 * Returns the journey *content*; the caller assembles the full Expedition row
 * (id/userId/createdAt/source) via the engine + storage.
 */
import { z } from 'zod';
import { callAI } from '@/ai/client';
import { extractJson } from '@/ai/extractJson';
import { pickModel } from '@/ai/modelRouter';
import { EXPEDITION_GEN_PROMPT } from '@/ai/prompts/polymath';
import type { ExpeditionStep, StepKind } from './expeditions';

const STEP_KINDS: StepKind[] = ['read', 'watch', 'do', 'reflect'];
export const MIN_STEPS = 5;
export const MAX_STEPS = 7;

const GeneratedExpeditionSchema = z.object({
  title: z.string().min(3),
  theme: z.string().min(2),
  steps: z.array(z.object({
    title: z.string().min(3),
    kind: z.string(),
    prompt: z.string().min(10),
    estMinutes: z.number(),
  })).min(1),
});

export interface GeneratedExpedition {
  title: string;
  theme: string;
  steps: ExpeditionStep[];
}

export interface ExpeditionGenInput {
  seedInterest?: string;
  seedSparkTitle?: string;
  theme?: string;
  profileSummary?: string;
}

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const validKind = (k: string): k is StepKind => (STEP_KINDS as string[]).includes(k);

/** Structural quality gate: right length, every step concrete, no reflect-spam. */
export function isValidExpedition(e: GeneratedExpedition): boolean {
  if (e.title.trim().length < 3) return false;
  if (e.steps.length < MIN_STEPS || e.steps.length > MAX_STEPS) return false;
  let reflects = 0;
  for (const s of e.steps) {
    if (!validKind(s.kind)) return false;
    if (s.title.trim().length < 3) return false;
    if (s.prompt.trim().length < 10) return false;
    if (!(s.estMinutes >= 5 && s.estMinutes <= 30)) return false;
    if (s.kind === 'reflect') reflects += 1;
  }
  return reflects <= 1;
}

/** Normalise raw schema-parsed output into indexed ExpeditionStep[]. */
function toSteps(raw: z.infer<typeof GeneratedExpeditionSchema>['steps']): ExpeditionStep[] {
  return raw.map((s, index) => ({
    index,
    title: s.title.trim(),
    kind: validKind(s.kind) ? s.kind : 'read',
    prompt: s.prompt.trim(),
    estMinutes: Math.min(30, Math.max(5, Math.round(s.estMinutes))),
  }));
}

const titleCase = (s: string) => s.replace(/(^|\s)\w/g, (m) => m.toUpperCase());

/** Curated 5-step fallback grounded in the seed. */
export function buildMockExpedition(input: ExpeditionGenInput): GeneratedExpedition {
  const seed = input.seedInterest || input.theme || input.seedSparkTitle || 'a new field';
  const title = `Seven days into ${titleCase(seed)}`;
  const steps: ExpeditionStep[] = [
    { index: 0, kind: 'read',    title: `Map the landscape of ${seed}`, prompt: `Spend 15 minutes writing what you already believe about ${seed}, then list the three biggest gaps in your understanding.`, estMinutes: 15 },
    { index: 1, kind: 'do',      title: `Find one primary source`,      prompt: `Track down one original work, dataset, or artefact at the heart of ${seed} and note one thing about it that surprised you.`, estMinutes: 20 },
    { index: 2, kind: 'read',    title: `The opposing view`,            prompt: `Find the strongest argument *against* a common belief in ${seed}. Write it in one paragraph as if you held it.`, estMinutes: 20 },
    { index: 3, kind: 'do',      title: `Make something small`,         prompt: `Produce one tiny artefact using what you've learned about ${seed} — a sketch, a list, a 5-line write-up.`, estMinutes: 25 },
    { index: 4, kind: 'reflect', title: `Connect it outward`,           prompt: `Name one field unrelated to ${seed} that shares a hidden structure with it, and one sentence on why.`, estMinutes: 10 },
  ];
  return { title, theme: seed, steps };
}

export async function generateExpedition(input: ExpeditionGenInput): Promise<GeneratedExpedition> {
  if (isMock()) return buildMockExpedition(input);

  let candidate: GeneratedExpedition | null = null;
  try {
    const response = await callAI({
      system: EXPEDITION_GEN_PROMPT,
      model: pickModel('generateExpedition'),
      cacheSystem: true,
      task: 'generateExpedition',
      maxTokens: 1800,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });
    const parsed = GeneratedExpeditionSchema.parse(extractJson(response));
    candidate = { title: parsed.title, theme: parsed.theme, steps: toSteps(parsed.steps) };
  } catch {
    candidate = null;
  }

  if (candidate && isValidExpedition(candidate)) return candidate;
  return buildMockExpedition(input); // never dead-end a "start expedition" tap
}
