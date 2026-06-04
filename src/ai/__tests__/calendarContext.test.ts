/**
 * Covers the pure summariser `eventsToRagItems` and the defensive async
 * `buildCalendarContext` wrapper. The integration modules are mocked so this
 * stays in pure Node (no OAuth driver / Supabase pull-in).
 */

jest.mock('@/integrations/googleCalendar/client', () => ({
  listCalendarEvents: jest.fn(),
}));
jest.mock('@/integrations/googleCalendar/oauth', () => ({
  isCalendarConnected: jest.fn(),
}));

import { eventsToRagItems, buildCalendarContext, fetchTodayCalendarEvents } from '../calendarContext';
import type { CalendarEvent } from '@/integrations/googleCalendar/client';
import { listCalendarEvents } from '@/integrations/googleCalendar/client';
import { isCalendarConnected } from '@/integrations/googleCalendar/oauth';

const mockList = listCalendarEvents as jest.MockedFunction<typeof listCalendarEvents>;
const mockConnected = isCalendarConnected as jest.MockedFunction<typeof isCalendarConnected>;

const MIN = 60_000;

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'e1',
    title: 'Meeting',
    date: '2026-06-10',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    startMs: 0,
    endMs: 60 * MIN,
    responseStatus: 'accepted',
    recurring: false,
    ...over,
  };
}

describe('eventsToRagItems (pure)', () => {
  it('emits a single "clear day" item when there are no events', () => {
    const items = eventsToRagItems([], '2026-06-10');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('cal:clear:2026-06-10');
    expect(items[0].text.toLowerCase()).toContain('clear');
    expect(items[0].metadata).toMatchObject({ kind: 'calendar', clear: true });
  });

  it('lists commitments with times and tells the planner to schedule around them', () => {
    const items = eventsToRagItems(
      [
        ev({ id: 'a', title: 'Standup', startTime: '09:00', endTime: '09:30', startMs: 0, endMs: 30 * MIN }),
        ev({ id: 'b', title: 'Lunch', startTime: '13:00', endTime: '14:00', startMs: 60 * MIN, endMs: 120 * MIN }),
      ],
      '2026-06-10',
    );
    const today = items.find((i) => i.id === 'cal:today:2026-06-10');
    expect(today).toBeDefined();
    expect(today!.text).toContain('09:00–09:30 Standup');
    expect(today!.text).toContain('13:00–14:00 Lunch');
    expect(today!.text.toLowerCase()).toContain('do not place blocks over them');
    // Two short events → not a heavy day.
    expect(items.find((i) => i.id === 'cal:load:2026-06-10')).toBeUndefined();
  });

  it('adds a heavy-day item when total meeting minutes are high', () => {
    const items = eventsToRagItems(
      [ev({ id: 'long', startMs: 0, endMs: 300 * MIN })], // 5h
      '2026-06-10',
    );
    const load = items.find((i) => i.id === 'cal:load:2026-06-10');
    expect(load).toBeDefined();
    expect(load!.metadata).toMatchObject({ heavy: true });
  });

  it('adds a heavy-day item when there are many events', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      ev({ id: `e${i}`, startMs: i * 10 * MIN, endMs: i * 10 * MIN + 5 * MIN }),
    );
    const items = eventsToRagItems(many, '2026-06-10');
    expect(items.find((i) => i.id === 'cal:load:2026-06-10')).toBeDefined();
  });

  it('labels all-day events and summarises overflow beyond the inline cap', () => {
    const events = [
      ev({ id: 'allday', title: 'Holiday', allDay: true, startTime: null, endTime: null }),
      ...Array.from({ length: 9 }, (_, i) =>
        ev({ id: `t${i}`, title: `T${i}`, startMs: i * MIN, endMs: i * MIN + MIN }),
      ),
    ];
    const today = eventsToRagItems(events, '2026-06-10').find((i) => i.id === 'cal:today:2026-06-10')!;
    expect(today.text).toContain('all-day Holiday');
    expect(today.text).toMatch(/\+\d+ more/); // 10 events, inline cap is 8
  });
});

describe('buildCalendarContext (defensive)', () => {
  const ENV = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    mockList.mockReset();
    mockConnected.mockReset();
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'fake-client.apps.googleusercontent.com';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = ENV;
  });

  it('returns [] when the calendar is not connected (never calls the API)', async () => {
    mockConnected.mockReturnValue(false);
    await expect(buildCalendarContext()).resolves.toEqual([]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns [] when the Google client id is missing', async () => {
    mockConnected.mockReturnValue(true);
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    await expect(buildCalendarContext()).resolves.toEqual([]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns [] (does not throw) when the calendar read fails', async () => {
    mockConnected.mockReturnValue(true);
    mockList.mockRejectedValue(new Error('network'));
    await expect(buildCalendarContext()).resolves.toEqual([]);
  });

  it('summarises fetched events when connected', async () => {
    mockConnected.mockReturnValue(true);
    mockList.mockResolvedValue([
      ev({ id: 'a', title: 'Standup', startTime: '09:00', endTime: '09:30' }),
    ]);
    const items = await buildCalendarContext();
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.text.includes('Standup'))).toBe(true);
  });
});

describe('fetchTodayCalendarEvents (defensive)', () => {
  const ENV = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    mockList.mockReset();
    mockConnected.mockReset();
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'fake-client.apps.googleusercontent.com';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = ENV;
  });

  it('returns null (not []) when the calendar is not connected', async () => {
    mockConnected.mockReturnValue(false);
    await expect(fetchTodayCalendarEvents()).resolves.toBeNull();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns null when the Google client id is missing', async () => {
    mockConnected.mockReturnValue(true);
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    await expect(fetchTodayCalendarEvents()).resolves.toBeNull();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns null on a read error', async () => {
    mockConnected.mockReturnValue(true);
    mockList.mockRejectedValue(new Error('boom'));
    await expect(fetchTodayCalendarEvents()).resolves.toBeNull();
  });

  it('returns the events when connected (empty array stays distinct from null)', async () => {
    mockConnected.mockReturnValue(true);
    mockList.mockResolvedValueOnce([]);
    await expect(fetchTodayCalendarEvents()).resolves.toEqual([]);

    mockConnected.mockReturnValue(true);
    mockList.mockResolvedValueOnce([ev({ id: 'a' })]);
    const out = await fetchTodayCalendarEvents();
    expect(out).toHaveLength(1);
    expect(out![0].id).toBe('a');
  });
});
