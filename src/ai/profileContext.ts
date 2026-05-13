/**
 * Compact profile snapshot for AI features that need grounding in who the user
 * is. The output is plain text, ≤ ~30 lines, deliberately short so it doesn't
 * dominate the token budget. Empty/null slots are omitted entirely.
 *
 * Used by the Ask LifeOS chatbot to ground answers in the user's actual life.
 */

import type { UserProfile } from './types';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${period}`;
}

function chronoLabel(c: UserProfile['chronotype']): string | null {
  if (c === 'lark') return 'morning person — peaks before noon';
  if (c === 'owl') return 'night owl — peaks late';
  if (c === 'balanced') return 'balanced energy';
  return null;
}

export interface ProfileContextOptions {
  /** Optional: today's routine, sorted by startTime — included as a "today" block. */
  todayBlocks?: Array<{
    startTime: string;
    endTime: string;
    title: string;
    module: string;
    status: string;
  }>;
  /** Optional: today's date in YYYY-MM-DD. Defaults to today. */
  todayDate?: string;
}

export function buildProfileContext(profile: UserProfile, opts: ProfileContextOptions = {}): string {
  const lines: string[] = [];
  const id = profile.identity;
  const sched = profile.schedule;
  const ip = profile.inferredPreferences;

  // Identity
  const idBits: string[] = [];
  if (id.firstName) idBits.push(id.firstName);
  if (id.ageBand) idBits.push(id.ageBand);
  if (id.seasonOfLife) idBits.push(id.seasonOfLife);
  if (idBits.length) lines.push(`Who: ${idBits.join(' · ')}`);

  // Vision + top goals
  if (profile.vision.statement) lines.push(`Vision: ${profile.vision.statement}`);
  if (profile.vision.topGoals.length) {
    lines.push(`Top goals: ${profile.vision.topGoals.slice(0, 5).join(' · ')}`);
  }

  // Schedule
  const sBits: string[] = [];
  if (sched.wakeTime && sched.sleepTime) sBits.push(`wake ${sched.wakeTime}, sleep ${sched.sleepTime}`);
  if (sched.workStartTime && sched.workEndTime) sBits.push(`work ${sched.workStartTime}–${sched.workEndTime}`);
  if (sBits.length) lines.push(`Schedule: ${sBits.join('; ')}`);
  if (sched.fixedBlocks.length) {
    const fb = sched.fixedBlocks
      .slice(0, 4)
      .map((b) => `${b.label} (${b.startTime}–${b.endTime})`)
      .join(', ');
    lines.push(`Fixed blocks: ${fb}`);
  }

  // Energy + focus
  const chrono = chronoLabel(profile.chronotype);
  if (chrono) lines.push(`Energy: ${chrono}`);
  if (profile.primaryDomains.length) {
    lines.push(`Focus domains: ${profile.primaryDomains.join(', ')}`);
  }

  // Habits + struggles + constraints
  if (profile.habits.current.length) {
    lines.push(`Currently holding: ${profile.habits.current.slice(0, 5).join(', ')}`);
  }
  if (profile.habits.aspirational.length) {
    lines.push(`Wants to build: ${profile.habits.aspirational.slice(0, 5).join(', ')}`);
  }
  if (profile.constraints.length) {
    lines.push(`Hard limits: ${profile.constraints.slice(0, 5).join('; ')}`);
  }
  if (profile.struggles.length) {
    lines.push(`Where they keep tripping: ${profile.struggles.slice(0, 3).join('; ')}`);
  }

  // Values + communication
  if (profile.values.length) lines.push(`Values: ${profile.values.slice(0, 5).join(', ')}`);
  if (profile.communication.tone) lines.push(`Preferred tone: ${profile.communication.tone}`);

  // Inferred (from actual behaviour)
  const ipBits: string[] = [];
  if (ip.productiveHours.length) ipBits.push(`productive at ${ip.productiveHours.map(formatHour).join('/')}`);
  if (ip.preferredBlockMinutes !== null) ipBits.push(`comfortable block ~${ip.preferredBlockMinutes}min`);
  if (ip.preferredRestDays.length) ipBits.push(`lighter on ${ip.preferredRestDays.map((d) => DOW_LABELS[d]).join('/')}`);
  if (ip.droppedHabits.length) ipBits.push(`keeps dropping: ${ip.droppedHabits.slice(0, 3).join(', ')}`);
  if (ipBits.length) lines.push(`Learned from behaviour: ${ipBits.join('; ')}`);

  // Today's routine
  if (opts.todayBlocks && opts.todayBlocks.length) {
    lines.push('');
    lines.push(`Today (${opts.todayDate ?? 'today'}):`);
    for (const b of opts.todayBlocks.slice(0, 12)) {
      const tick = b.status === 'completed' ? '✓' : b.status === 'skipped' ? '✗' : '·';
      lines.push(`  ${tick} ${b.startTime}–${b.endTime} ${b.title} [${b.module}]`);
    }
  }

  if (lines.length === 0) return '';
  return ['<user_context>', ...lines, '</user_context>'].join('\n');
}
