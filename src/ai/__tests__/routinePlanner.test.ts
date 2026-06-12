/**
 * Tests for routinePlanner.ts.
 *
 * planRoutineWithContext is a thin public wrapper over planRoutineWithContextDetailed.
 * planRoutineWithContextDetailed:
 *   1. Builds history context (error-tolerant)
 *   2. Folds in calendar context (never throws)
 *   3. Folds in bills context (never throws)
 *   4. Optionally loads lastWeekDomainMinutes via dynamic import
 *   5. Delegates to planRoutineAgent with merged input
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockBuildHistoryContext = jest.fn();
const mockBuildCalendarContext = jest.fn();
const mockBuildBillsContext = jest.fn();
const mockPlanRoutineAgent = jest.fn();
const mockComputeLastWeekDomainMinutes = jest.fn();

jest.mock('../historyContext', () => ({
  buildHistoryContext: (...a: unknown[]) => mockBuildHistoryContext(...a),
}));
jest.mock('../calendarContext', () => ({
  buildCalendarContext: (...a: unknown[]) => mockBuildCalendarContext(...a),
}));
jest.mock('../billsContext', () => ({
  buildBillsContext: (...a: unknown[]) => mockBuildBillsContext(...a),
}));
jest.mock('../agent/planner', () => ({
  planRoutineAgent: (...a: unknown[]) => mockPlanRoutineAgent(...a),
}));
// Mock the dynamic import
jest.mock('@/utils/routineBalance', () => ({
  computeLastWeekDomainMinutes: (...a: unknown[]) => mockComputeLastWeekDomainMinutes(...a),
}));

// ─── System under test ────────────────────────────────────────────────────────

import { planRoutineWithContext, planRoutineWithContextDetailed } from '../routinePlanner';
import type { RoutineInput } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeRoutine = {
  blocks: [{ startTime: '08:00', endTime: '09:00', title: 'Run', module: 'health', energyRequired: 'medium' }],
};
const fakeAgentResult = { plan: fakeRoutine, contextUsed: 1, iterations: 2 };

function makeInput(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    wakeTime: '06:30',
    sleepTime: '22:30',
    workStartTime: '09:00',
    workEndTime: '17:00',
    primaryDomains: ['health', 'career'],
    ...overrides,
  };
}

function silentMocks() {
  mockBuildHistoryContext.mockReturnValue([]);
  mockBuildCalendarContext.mockResolvedValue([]);
  mockBuildBillsContext.mockResolvedValue([]);
  mockPlanRoutineAgent.mockResolvedValue(fakeAgentResult);
  mockComputeLastWeekDomainMinutes.mockReturnValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
});

// ─── planRoutineWithContext ────────────────────────────────────────────────────

describe('planRoutineWithContext', () => {
  it('returns just the plan (GeneratedRoutine) from the agent result', async () => {
    const result = await planRoutineWithContext(makeInput());
    expect(result).toBe(fakeRoutine);
  });

  it('passes the routine input fields through to planRoutineAgent', async () => {
    await planRoutineWithContext(makeInput({ wakeTime: '05:45', primaryDomains: ['finance'] }));
    const input = mockPlanRoutineAgent.mock.calls[0][0];
    expect(input.wakeTime).toBe('05:45');
    expect(input.primaryDomains).toEqual(['finance']);
    expect(input.sleepTime).toBe('22:30');
  });
});

// ─── planRoutineWithContextDetailed ───────────────────────────────────────────

describe('planRoutineWithContextDetailed', () => {
  it('returns the full agent result (plan + trace)', async () => {
    const result = await planRoutineWithContextDetailed(makeInput());
    expect(result).toBe(fakeAgentResult);
  });

  describe('history context', () => {
    it('passes history items to planRoutineAgent as contextItems', async () => {
      const historyItems = [{ id: 'reflect:2026-06-01', text: 'Good day', salience: 0.5 }];
      mockBuildHistoryContext.mockReturnValue(historyItems);

      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems).toContainEqual(historyItems[0]);
    });

    it('continues with empty contextItems when buildHistoryContext throws', async () => {
      mockBuildHistoryContext.mockImplementation(() => { throw new Error('db error'); });

      await expect(planRoutineWithContextDetailed(makeInput())).resolves.toBe(fakeAgentResult);
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems).toEqual([]); // calendar + bills also empty in this test
    });
  });

  describe('calendar context', () => {
    it('appends calendar items to contextItems', async () => {
      const calItems = [{ id: 'cal:1', text: 'Meeting 10:00', salience: 0.9 }];
      mockBuildCalendarContext.mockResolvedValue(calItems);

      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems).toContainEqual(calItems[0]);
    });

    it('omits calendar items when empty array returned (not connected)', async () => {
      mockBuildCalendarContext.mockResolvedValue([]);
      const histItems = [{ id: 'r:1', text: 'Reflect', salience: 0.3 }];
      mockBuildHistoryContext.mockReturnValue(histItems);

      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems).toEqual(histItems);
    });
  });

  describe('bills context', () => {
    it('appends bill items to contextItems', async () => {
      const billItems = [{ id: 'bill:1', text: 'Netflix $15 due 2026-06-10', salience: 0.6 }];
      mockBuildBillsContext.mockResolvedValue(billItems);

      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems).toContainEqual(billItems[0]);
    });

    it('omits bill items when empty array returned', async () => {
      mockBuildBillsContext.mockResolvedValue([]);
      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.contextItems.some((i: { id: string }) => i.id.startsWith('bill:'))).toBe(false);
    });
  });

  describe('domain minutes (lastWeekDomainMinutes)', () => {
    it('loads lastWeekDomainMinutes via dynamic import when not provided', async () => {
      mockComputeLastWeekDomainMinutes.mockReturnValue({ health: 120, career: 60 });

      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.lastWeekDomainMinutes).toEqual({ health: 120, career: 60 });
    });

    it('uses caller-provided lastWeekDomainMinutes without loading', async () => {
      const provided = { finance: 90 };
      await planRoutineWithContextDetailed(makeInput({ lastWeekDomainMinutes: provided }));
      // computeLastWeekDomainMinutes should NOT be called when already provided
      expect(mockComputeLastWeekDomainMinutes).not.toHaveBeenCalled();
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.lastWeekDomainMinutes).toBe(provided);
    });

    it('continues without domain minutes when the import fails', async () => {
      mockComputeLastWeekDomainMinutes.mockImplementation(() => { throw new Error('balance error'); });

      await expect(planRoutineWithContextDetailed(makeInput())).resolves.toBe(fakeAgentResult);
    });
  });

  describe('dayOfWeek', () => {
    it('defaults dayOfWeek to today when not provided', async () => {
      await planRoutineWithContextDetailed(makeInput());
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.dayOfWeek).toBe(new Date().getDay());
    });

    it('passes through caller-specified dayOfWeek', async () => {
      await planRoutineWithContextDetailed(makeInput({ dayOfWeek: 3 }));
      const input = mockPlanRoutineAgent.mock.calls[0][0];
      expect(input.dayOfWeek).toBe(3);
    });
  });

  it('merges history + calendar + bills into a single contextItems array', async () => {
    mockBuildHistoryContext.mockReturnValue([{ id: 'h', text: 'history', salience: 0.5 }]);
    mockBuildCalendarContext.mockResolvedValue([{ id: 'c', text: 'calendar', salience: 0.9 }]);
    mockBuildBillsContext.mockResolvedValue([{ id: 'b', text: 'bill', salience: 0.6 }]);

    await planRoutineWithContextDetailed(makeInput());
    const input = mockPlanRoutineAgent.mock.calls[0][0];
    expect(input.contextItems.map((i: { id: string }) => i.id)).toEqual(['h', 'c', 'b']);
  });
});
