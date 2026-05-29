import { buildLifeOsTools } from '../agent/tools';

jest.mock('@/db/queries/goals', () => ({ getGoalsByUser: jest.fn() }));
jest.mock('@/db/queries/routine', () => ({ getRoutineBlocksByDate: jest.fn() }));
jest.mock('@/db/queries/health', () => ({ getLatestSleepHours: jest.fn() }));
jest.mock('@/db/queries/gamification', () => ({ getOrCreateGamification: jest.fn() }));
jest.mock('@/db/queries/social', () => ({
  getContactsByUser: jest.fn(),
  computeOverdue: jest.fn(),
}));

import { getGoalsByUser } from '@/db/queries/goals';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getLatestSleepHours } from '@/db/queries/health';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { getContactsByUser, computeOverdue } from '@/db/queries/social';

const goalsMock = getGoalsByUser as jest.Mock;
const routineMock = getRoutineBlocksByDate as jest.Mock;
const sleepMock = getLatestSleepHours as jest.Mock;
const gamMock = getOrCreateGamification as jest.Mock;
const contactsMock = getContactsByUser as jest.Mock;
const overdueMock = computeOverdue as jest.Mock;

function toolByName(name: string) {
  const t = buildLifeOsTools({ userId: 'u1', today: '2026-05-30' }).find(
    (x) => x.declaration.name === name,
  );
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

describe('buildLifeOsTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the expected read-only tools', () => {
    const names = buildLifeOsTools({ userId: 'u1' }).map((t) => t.declaration.name).sort();
    expect(names).toEqual(
      ['getGoals', 'getMomentum', 'getOverdueContacts', 'getRecentSleepHours', 'getTodayRoutine'].sort(),
    );
  });

  it('getGoals returns only active goals in compact shape', async () => {
    goalsMock.mockReturnValue([
      { title: 'Ship', goalType: 'career', level: 'yearly', status: 'active' },
      { title: 'Old', goalType: 'health', level: 'yearly', status: 'abandoned' },
    ]);
    const out = await toolByName('getGoals').execute({});
    expect(out).toEqual([{ title: 'Ship', domain: 'career', level: 'yearly', status: 'active' }]);
  });

  it('getTodayRoutine queries the injected date', async () => {
    routineMock.mockReturnValue([
      { startTime: '09:00', endTime: '10:00', title: 'Focus', module: 'career', status: 'upcoming', id: 'x' },
    ]);
    const out = await toolByName('getTodayRoutine').execute({});
    expect(routineMock).toHaveBeenCalledWith('2026-05-30');
    expect(out).toEqual([
      { startTime: '09:00', endTime: '10:00', title: 'Focus', module: 'career', status: 'upcoming' },
    ]);
  });

  it('getRecentSleepHours honours maxAgeDays arg, defaults to 3', async () => {
    sleepMock.mockReturnValue(6.5);
    expect(await toolByName('getRecentSleepHours').execute({})).toBe(6.5);
    expect(sleepMock).toHaveBeenCalledWith(3);
    await toolByName('getRecentSleepHours').execute({ maxAgeDays: 7 });
    expect(sleepMock).toHaveBeenLastCalledWith(7);
  });

  it('getMomentum parses JSON string fields safely', async () => {
    gamMock.mockReturnValue({
      domainScores: JSON.stringify({ career: 70 }),
      streaks: JSON.stringify({ learning: { count: 5, lastDate: '2026-05-29' } }),
      totalXP: 1200,
    });
    const out = (await toolByName('getMomentum').execute({})) as Record<string, unknown>;
    expect(out).toEqual({
      domainScores: { career: 70 },
      streaks: { learning: { count: 5, lastDate: '2026-05-29' } },
      totalXP: 1200,
    });
  });

  it('getMomentum tolerates corrupt JSON without throwing', async () => {
    gamMock.mockReturnValue({ domainScores: '{bad', streaks: 'also bad', totalXP: 0 });
    const out = (await toolByName('getMomentum').execute({})) as Record<string, unknown>;
    expect(out).toEqual({ domainScores: {}, streaks: {}, totalXP: 0 });
  });

  it('getOverdueContacts returns only overdue contacts with overdueByDays', async () => {
    contactsMock.mockReturnValue([{ name: 'Alex' }, { name: 'Sam' }]);
    overdueMock.mockImplementation((c: { name: string }) =>
      c.name === 'Alex'
        ? { isOverdue: true, overdueBy: 4, daysSinceContact: 10 }
        : { isOverdue: false, overdueBy: 0, daysSinceContact: 1 },
    );
    const out = await toolByName('getOverdueContacts').execute({});
    expect(out).toEqual([{ name: 'Alex', overdueByDays: 4 }]);
  });
});
