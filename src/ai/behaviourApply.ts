/**
 * Apply paths for P3-04 adaptation suggestions. Pure DB writes — never an AI
 * call. Each `apply()` only mutates future blocks (date >= today) so we never
 * rewrite history.
 *
 * The `regenerate_week` path delegates to the P3-03 `generateAndSaveWeek`
 * helper, which is the only path that touches the AI.
 */

import { addDays, format } from 'date-fns';
import {
  deleteRoutineBlock,
  getRoutineBlocksInRange,
  updateRoutineBlock,
} from '@/db/queries/routine';
import { generateAndSaveWeek } from './replanApply';
import { getUserProfile } from '@/db/queries/userProfile';
import type { BehaviourSuggestion, SuggestionApply } from '@/utils/behaviourPatterns';

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function matches(title: string, needle: string): boolean {
  return title.toLowerCase().includes(needle.toLowerCase());
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return h * 60 + (m || 0);
}
function fromMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface ApplyResult {
  ok: boolean;
  affected: number;
  message: string;
}

async function applyRewriteTime(
  a: Extract<SuggestionApply, { type: 'rewrite_time' }>,
): Promise<ApplyResult> {
  const start = todayStr();
  const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, end);
  let affected = 0;
  for (const b of blocks) {
    if (!matches(b.title, a.titleSubstring)) continue;
    if (b.status === 'completed' || b.status === 'skipped') continue;
    updateRoutineBlock(b.id, { startTime: a.newStartTime, endTime: a.newEndTime });
    affected += 1;
  }
  return { ok: true, affected, message: `Moved ${affected} upcoming block${affected === 1 ? '' : 's'} to ${a.newStartTime}.` };
}

async function applyShrinkDuration(
  a: Extract<SuggestionApply, { type: 'shrink_duration' }>,
): Promise<ApplyResult> {
  const start = todayStr();
  const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, end);
  let affected = 0;
  for (const b of blocks) {
    if (!matches(b.title, a.titleSubstring)) continue;
    if (b.status === 'completed' || b.status === 'skipped') continue;
    const s = toMin(b.startTime);
    const e = toMin(b.endTime);
    if (e - s <= a.targetDurationMin) continue; // already short enough
    updateRoutineBlock(b.id, { endTime: fromMin(s + a.targetDurationMin) });
    affected += 1;
  }
  return { ok: true, affected, message: `Shrunk ${affected} block${affected === 1 ? '' : 's'} to ${a.targetDurationMin} min.` };
}

async function applyDropTitle(
  a: Extract<SuggestionApply, { type: 'drop_title' }>,
): Promise<ApplyResult> {
  const start = todayStr();
  const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, end);
  let affected = 0;
  for (const b of blocks) {
    if (!matches(b.title, a.titleSubstring)) continue;
    if (b.status === 'completed' || b.status === 'skipped') continue;
    deleteRoutineBlock(b.id);
    affected += 1;
  }
  return { ok: true, affected, message: `Removed ${affected} upcoming block${affected === 1 ? '' : 's'}.` };
}

async function applyRegenerateWeek(userId: string): Promise<ApplyResult> {
  const profile = await getUserProfile(userId);
  if (!profile) return { ok: false, affected: 0, message: 'No profile found — finish onboarding first.' };
  const start = todayStr();
  const week = await generateAndSaveWeek({
    userId,
    startDate: start,
    profile,
    primaryDomains: profile.primaryDomains,
  });
  return {
    ok: true,
    affected: week.days.reduce((sum, d) => sum + d.blocks.length, 0),
    message: `Regenerated ${week.days.length}-day plan with ${week.days.reduce((sum, d) => sum + d.blocks.length, 0)} blocks.`,
  };
}

export async function applyBehaviourSuggestion(
  userId: string,
  s: BehaviourSuggestion,
): Promise<ApplyResult> {
  switch (s.apply.type) {
    case 'rewrite_time':       return applyRewriteTime(s.apply);
    case 'shrink_duration':    return applyShrinkDuration(s.apply);
    case 'drop_title':         return applyDropTitle(s.apply);
    case 'regenerate_week':    return applyRegenerateWeek(userId);
  }
}
