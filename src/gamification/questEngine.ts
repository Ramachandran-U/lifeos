import { rngFromKey, pickWeighted } from '@/utils/seededRandom';
import { STARTER_COPY } from '@/constants/starterCopy';

/**
 * Daily quest engine (quests_v2) — pure + seeded.
 *
 * Replaces the three hardcoded DEFAULT_QUESTS with procedural selection from a
 * template pool: 3–5 quests per day, weighted toward the user's primary
 * domains, live streaks, and any stagnant domain the cognition layer flagged.
 * Selection is keyed by hash(userId + dayLocal), so generation is idempotent —
 * re-running on the same day always yields the same set (safe to call from
 * every screen focus), and tests are deterministic.
 *
 * The AI personalization pass (generateDailyQuests) may only RETITLE or
 * RETARGET drafts produced here — metricKey comes from this enum and targets
 * are clamped to the template range, so the model can never invent a quest the
 * app can't track (see clampDraftToTemplate).
 */

// Progress events the app can actually feed. Each maps to a real call site —
// add the wiring BEFORE adding a key here, never the other way around.
export type QuestMetricKey =
  | 'blocks_completed'   // useGameStore.completeBlock
  | 'meals_logged'       // Health tab food log
  | 'weight_logged'      // Health tab weight log
  | 'water_logged'       // Health tab water card
  | 'learning_resource'  // Explore: resource completed
  | 'spark_engaged'      // Explore: spark saved / thread pulled
  | 'journal'            // Evening Reflect completed
  | 'social_touch'       // Social: interaction logged
  | 'goal_task';         // useGameStore.completeGoalNode

export type QuestModule = 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath';

export interface QuestTemplate {
  id: string;
  module: QuestModule;
  metricKey: QuestMetricKey;
  /** Title for a given target. Keep ≤ 48 chars — QuestCard truncates at one line. */
  title: (target: number) => string;
  /** [min, max] inclusive; difficulty scales inside this range. */
  targetRange: [number, number];
  /** XP per unit of target (total xp = perUnit × target, rounded to 5). */
  xpPerUnit: number;
  /** Streak this quest feeds, if any — selection boosts live streaks. */
  streakKey?: 'workout' | 'learning' | 'foodTracking' | 'journaling' | 'social';
}

export const QUEST_TEMPLATES: readonly QuestTemplate[] = [
  // goal / routine
  { id: 't_blocks_small', module: 'goal', metricKey: 'blocks_completed', title: (t) => `Complete ${t} routine block${t > 1 ? 's' : ''}`, targetRange: [2, 5], xpPerUnit: 10 },
  { id: 't_blocks_full', module: 'goal', metricKey: 'blocks_completed', title: () => 'Finish every block before dinner', targetRange: [5, 8], xpPerUnit: 12 },
  { id: 't_goal_task', module: 'goal', metricKey: 'goal_task', title: (t) => `Move ${t} goal${t > 1 ? 's' : ''} forward`, targetRange: [1, 3], xpPerUnit: 20 },
  // health
  { id: 't_meals', module: 'health', metricKey: 'meals_logged', title: (t) => `Log ${t} meals today`, targetRange: [2, 4], xpPerUnit: 10, streakKey: 'foodTracking' },
  { id: 't_weight', module: 'health', metricKey: 'weight_logged', title: () => 'Log your weight', targetRange: [1, 1], xpPerUnit: 15 },
  { id: 't_water', module: 'health', metricKey: 'water_logged', title: (t) => `Hit ${t} glasses of water`, targetRange: [4, 8], xpPerUnit: 5 },
  { id: 't_workout_block', module: 'health', metricKey: 'blocks_completed', title: () => 'Complete a health block', targetRange: [1, 2], xpPerUnit: 20, streakKey: 'workout' },
  // polymath / learning
  { id: 't_resource', module: 'polymath', metricKey: 'learning_resource', title: () => 'Finish a learning resource', targetRange: [1, 1], xpPerUnit: 60, streakKey: 'learning' },
  { id: 't_spark', module: 'polymath', metricKey: 'spark_engaged', title: (t) => `Chase ${t} spark${t > 1 ? 's' : ''} of curiosity`, targetRange: [1, 2], xpPerUnit: 20, streakKey: 'learning' },
  // journaling / reflection
  { id: 't_journal', module: 'goal', metricKey: 'journal', title: () => 'Close the day with a reflection', targetRange: [1, 1], xpPerUnit: 30, streakKey: 'journaling' },
  // social
  { id: 't_social_touch', module: 'social', metricKey: 'social_touch', title: (t) => `Reach out to ${t} ${t > 1 ? 'people' : 'person'}`, targetRange: [1, 2], xpPerUnit: 25, streakKey: 'social' },
  // career / finance ride on blocks + goal tasks for now (no bespoke metrics yet)
  { id: 't_career_block', module: 'career', metricKey: 'blocks_completed', title: () => 'Complete a career block', targetRange: [1, 2], xpPerUnit: 20 },
  { id: 't_finance_goal', module: 'finance', metricKey: 'goal_task', title: () => 'Move a money goal forward', targetRange: [1, 1], xpPerUnit: 25 },
] as const;

export interface QuestDraft {
  templateId: string;
  title: string;
  module: QuestModule;
  metricKey: QuestMetricKey;
  target: number;
  xp: number;
  /**
   * 'pinned' marks the day-1 constructed first quest (cold_start_v1) so the
   * store inserts it with source 'pinned' — which the AI personalization
   * pass's `source === 'template'` filter already excludes with zero new
   * filter code. Procedural drafts never carry this field.
   */
  source?: 'pinned';
}

export interface QuestSelectionCtx {
  /** The user's chosen focus domains (module keys: goal/health/...). */
  primaryDomains: string[];
  /** Streak types with a live run (count > 0) — quests that feed them rank up. */
  liveStreakKeys: string[];
  /** Domain the stagnation detector flagged, if any — gets the biggest boost. */
  stagnantDomain?: string | null;
  /** Yesterday's plan-completion ratio 0..1 — scales difficulty. Default 0.5. */
  yesterdayCompletionPct?: number;
  /** Templates to avoid (e.g. the one being rerolled). */
  excludeTemplateIds?: string[];
  /**
   * Day-1 clamp (cold_start_v1): exactly 3 quests, slot 1 pinned to a
   * target-1 first-block quest. Set by buildCtx when yesterday had zero
   * routine blocks AND totalXP === 0.
   */
  isFirstDay?: boolean;
}

function targetFor(template: QuestTemplate, completion: number, rng: () => number): number {
  const [min, max] = template.targetRange;
  // Difficulty follows yesterday's completion with ±1 step of seeded jitter.
  const ideal = min + (max - min) * completion;
  const jitter = (rng() - 0.5); // -0.5..0.5
  return Math.min(max, Math.max(min, Math.round(ideal + jitter)));
}

function xpFor(template: QuestTemplate, target: number): number {
  return Math.max(5, Math.round((template.xpPerUnit * target) / 5) * 5);
}

/**
 * Pick 3–5 daily quests for `seedKey` (= `${userId}:${dayLocal}` by
 * convention; pass `:reroll:${n}` suffixes for replacements). Deterministic
 * for a given (ctx, seedKey). At most one quest per metricKey so progress
 * events never double-tick.
 */
export function selectDailyQuests(ctx: QuestSelectionCtx, seedKey: string): QuestDraft[] {
  const rng = rngFromKey(seedKey);
  const completion = Math.min(1, Math.max(0, ctx.yesterdayCompletionPct ?? 0.5));
  const exclude = new Set(ctx.excludeTemplateIds ?? []);

  // Day 1 is exactly 3 quests — never 3–5 (cold-start spec §3.3). The
  // non-first-day branch consumes the SAME rng draws as before the clamp
  // landed, so existing seeds stay byte-identical.
  const count = ctx.isFirstDay ? 3 : 3 + Math.floor(rng() * 3); // 3..5
  const picked: QuestDraft[] = [];
  const usedTemplates = new Set<string>();
  const usedMetrics = new Set<QuestMetricKey>();

  if (ctx.isFirstDay) {
    // Slot 1 is CONSTRUCTED directly — bypassing targetFor, because target 1
    // sits below t_blocks_small's [2,5] range, which stays untouched for
    // normal days. Marking template + metric as used keeps the remaining two
    // procedural picks from double-ticking blocks_completed.
    const template = QUEST_TEMPLATES.find((t) => t.id === 't_blocks_small');
    if (template && !exclude.has(template.id)) {
      picked.push({
        templateId: template.id,
        title: STARTER_COPY.firstQuestTitle,
        module: template.module,
        metricKey: template.metricKey,
        target: 1,
        xp: xpFor(template, 1), // = 10
        source: 'pinned',
      });
      usedTemplates.add(template.id);
      usedMetrics.add(template.metricKey);
    }
  }

  // Re-weight after every pick so exclusions hold without a fixed order bias.
  for (let i = picked.length; i < count; i++) {
    const candidates = QUEST_TEMPLATES.filter(
      (t) => !usedTemplates.has(t.id) && !usedMetrics.has(t.metricKey) && !exclude.has(t.id),
    );
    if (candidates.length === 0) break;
    const weights = candidates.map((t) => {
      let w = 1;
      if (ctx.primaryDomains.includes(t.module)) w += 2;
      if (t.streakKey && ctx.liveStreakKeys.includes(t.streakKey)) w += 2;
      if (ctx.stagnantDomain && t.module === ctx.stagnantDomain) w += 3;
      return w;
    });
    const template = candidates[pickWeighted(rng, weights)];
    const target = targetFor(template, completion, rng);
    picked.push({
      templateId: template.id,
      title: template.title(target),
      module: template.module,
      metricKey: template.metricKey,
      target,
      xp: xpFor(template, target),
    });
    usedTemplates.add(template.id);
    usedMetrics.add(template.metricKey);
  }

  return picked;
}

/**
 * Safety clamp for AI-personalized drafts: the model may retitle and retarget,
 * but the metricKey must match a known template and the target/xp stay inside
 * the template's bounds. Returns null when the draft is untrackable.
 */
export function clampDraftToTemplate(draft: {
  templateId?: string;
  title?: string;
  metricKey: string;
  target: number;
  xp: number;
}): QuestDraft | null {
  const template =
    QUEST_TEMPLATES.find((t) => t.id === draft.templateId) ??
    QUEST_TEMPLATES.find((t) => t.metricKey === draft.metricKey);
  if (!template || template.metricKey !== draft.metricKey) return null;
  const [min, max] = template.targetRange;
  const target = Math.min(max, Math.max(min, Math.round(draft.target)));
  const title = (draft.title ?? '').trim().slice(0, 64) || template.title(target);
  return {
    templateId: template.id,
    title,
    module: template.module,
    metricKey: template.metricKey,
    target,
    // AI may not inflate rewards: cap at the template's own economics.
    xp: Math.min(xpFor(template, target), Math.max(5, Math.round(draft.xp / 5) * 5)),
  };
}
