import { buildProfileContext } from '../profileContext';
import { emptyUserProfile } from '../types';
import type { UserProfile } from '../types';

function p(overrides: Partial<UserProfile> = {}): UserProfile {
  return { ...emptyUserProfile(), ...overrides };
}

// Minimal identity so the profile is non-empty in tests that focus on other fields.
const withName: Partial<UserProfile> = {
  identity: { firstName: 'Alex', ageBand: null, seasonOfLife: null },
};

describe('buildProfileContext', () => {
  it('returns empty string for a fully empty profile', () => {
    expect(buildProfileContext(emptyUserProfile())).toBe('');
  });

  it('wraps non-empty output in <user_context> tags', () => {
    const out = buildProfileContext(p(withName));
    expect(out.startsWith('<user_context>')).toBe(true);
    expect(out.endsWith('</user_context>')).toBe(true);
  });

  describe('identity', () => {
    it('renders all three identity bits joined by ·', () => {
      const out = buildProfileContext(
        p({ identity: { firstName: 'Priya', ageBand: '30s', seasonOfLife: 'new parent' } }),
      );
      expect(out).toContain('Who: Priya · 30s · new parent');
    });

    it('omits the Who line when all identity fields are null', () => {
      expect(buildProfileContext(emptyUserProfile())).not.toContain('Who:');
    });

    it('renders partial identity when only first name is set', () => {
      const out = buildProfileContext(p(withName));
      expect(out).toContain('Who: Alex');
      expect(out).not.toContain('·');
    });
  });

  describe('vision', () => {
    it('includes vision statement', () => {
      const out = buildProfileContext(p({ ...withName, vision: { statement: 'Build financial freedom', horizon: null, topGoals: [] } }));
      expect(out).toContain('Vision: Build financial freedom');
    });

    it('includes top goals line', () => {
      const out = buildProfileContext(p({ ...withName, vision: { statement: null, horizon: null, topGoals: ['Run a marathon', 'Save £50k'] } }));
      expect(out).toContain('Top goals: Run a marathon · Save £50k');
    });

    it('caps top goals at 5', () => {
      const goals = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
      const out = buildProfileContext(p({ ...withName, vision: { statement: null, horizon: null, topGoals: goals } }));
      expect(out).toContain('g5');
      expect(out).not.toContain('g6');
    });
  });

  describe('schedule', () => {
    it('renders wake/sleep times', () => {
      const out = buildProfileContext(p({
        ...withName,
        schedule: { wakeTime: '06:00', sleepTime: '22:30', workStartTime: null, workEndTime: null, fixedBlocks: [] },
      }));
      expect(out).toContain('wake 06:00, sleep 22:30');
    });

    it('renders work hours when both are set', () => {
      const out = buildProfileContext(p({
        ...withName,
        schedule: { wakeTime: null, sleepTime: null, workStartTime: '09:00', workEndTime: '17:00', fixedBlocks: [] },
      }));
      expect(out).toContain('work 09:00–17:00');
    });

    it('omits work hours when only one side is set', () => {
      const out = buildProfileContext(p({
        ...withName,
        schedule: { wakeTime: null, sleepTime: null, workStartTime: '09:00', workEndTime: null, fixedBlocks: [] },
      }));
      expect(out).not.toContain('work');
    });

    it('renders up to 4 fixed blocks', () => {
      const blocks = ['A', 'B', 'C', 'D', 'E'].map((label) => ({
        label,
        startTime: '08:00',
        endTime: '09:00',
        daysOfWeek: [1] as number[],
        kind: 'work' as const,
      }));
      const out = buildProfileContext(p({
        ...withName,
        schedule: { wakeTime: null, sleepTime: null, workStartTime: null, workEndTime: null, fixedBlocks: blocks },
      }));
      expect(out).toContain('Fixed blocks:');
      expect(out).toContain('D (');
      expect(out).not.toContain('E (');
    });
  });

  describe('chronotype', () => {
    it.each([
      ['lark', 'morning person — peaks before noon'],
      ['owl', 'night owl — peaks late'],
      ['balanced', 'balanced energy'],
    ] as const)('%s maps to correct label', (chronotype, label) => {
      const out = buildProfileContext(p({ ...withName, chronotype }));
      expect(out).toContain(label);
    });

    it('omits energy line when chronotype is null', () => {
      const out = buildProfileContext(p(withName));
      expect(out).not.toContain('Energy:');
    });
  });

  describe('domains and habits', () => {
    it('renders focus domains', () => {
      const out = buildProfileContext(p({ ...withName, primaryDomains: ['health', 'career'] }));
      expect(out).toContain('Focus domains: health, career');
    });

    it('renders current and aspirational habits', () => {
      const out = buildProfileContext(p({
        ...withName,
        habits: { current: ['exercise', 'reading'], aspirational: ['meditation'] },
      }));
      expect(out).toContain('Currently holding: exercise, reading');
      expect(out).toContain('Wants to build: meditation');
    });

    it('renders constraints and struggles', () => {
      const out = buildProfileContext(p({
        ...withName,
        constraints: ['no screens after 9pm'],
        struggles: ['procrastination'],
      }));
      expect(out).toContain('Hard limits: no screens after 9pm');
      expect(out).toContain('Where they keep tripping: procrastination');
    });
  });

  describe('inferred preferences', () => {
    it('renders productive hours in AM/PM format', () => {
      const out = buildProfileContext(p({
        ...withName,
        inferredPreferences: {
          productiveHours: [9, 14],
          preferredBlockMinutes: null,
          droppedHabits: [],
          preferredRestDays: [],
          lastInferredAt: null,
        },
      }));
      expect(out).toContain('productive at 9AM/2PM');
    });

    it('renders preferred block minutes', () => {
      const out = buildProfileContext(p({
        ...withName,
        inferredPreferences: {
          productiveHours: [],
          preferredBlockMinutes: 45,
          droppedHabits: [],
          preferredRestDays: [],
          lastInferredAt: null,
        },
      }));
      expect(out).toContain('comfortable block ~45min');
    });

    it('renders preferred rest days as DOW abbreviations', () => {
      const out = buildProfileContext(p({
        ...withName,
        inferredPreferences: {
          productiveHours: [],
          preferredBlockMinutes: null,
          droppedHabits: [],
          preferredRestDays: [0, 6],
          lastInferredAt: null,
        },
      }));
      expect(out).toContain('lighter on Sun/Sat');
    });

    it('omits inferred section when all fields are empty/null', () => {
      const out = buildProfileContext(p(withName));
      expect(out).not.toContain('Learned from behaviour:');
    });
  });

  describe('today blocks', () => {
    const todayBlocks = [
      { startTime: '09:00', endTime: '10:00', title: 'Workout', module: 'health', status: 'completed' },
      { startTime: '10:00', endTime: '11:00', title: 'Reading', module: 'polymath', status: 'skipped' },
      { startTime: '11:00', endTime: '12:00', title: 'Deep work', module: 'career', status: 'upcoming' },
    ];

    it('renders completed as ✓, skipped as ✗, and others as ·', () => {
      const out = buildProfileContext(p(withName), { todayBlocks, todayDate: '2026-06-09' });
      expect(out).toContain('✓ 09:00–10:00 Workout [health]');
      expect(out).toContain('✗ 10:00–11:00 Reading [polymath]');
      expect(out).toContain('· 11:00–12:00 Deep work [career]');
    });

    it('shows the provided date in the Today header', () => {
      const out = buildProfileContext(p(withName), { todayBlocks, todayDate: '2026-06-09' });
      expect(out).toContain('Today (2026-06-09):');
    });

    it('caps today blocks at 12', () => {
      const blocks = Array.from({ length: 15 }, (_, i) => ({
        startTime: `${String(i).padStart(2, '0')}:00`,
        endTime: `${String(i + 1).padStart(2, '0')}:00`,
        title: `Block ${i}`,
        module: 'goal',
        status: 'upcoming',
      }));
      const out = buildProfileContext(p(withName), { todayBlocks: blocks });
      expect(out).toContain('Block 11');
      expect(out).not.toContain('Block 12');
    });

    it('omits today section when no blocks provided', () => {
      const out = buildProfileContext(p(withName));
      expect(out).not.toContain('Today (');
    });
  });
});
