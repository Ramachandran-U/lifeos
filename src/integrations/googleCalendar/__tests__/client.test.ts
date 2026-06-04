/**
 * Google Calendar REST client — create-vs-update routing in syncBlocksToCalendar,
 * eventId capture, per-block failure accumulation, and the delete event's
 * 404/410 swallow-vs-throw behaviour.
 */

// oauth.ts re-exports a binding off the shared driver, which transitively pulls
// in the Supabase session module; the client only needs the bearer accessor.
jest.mock('../oauth', () => ({
  getCalendarAccessToken: jest.fn().mockResolvedValue('cal-tok'),
}));

import {
  syncBlocksToCalendar,
  deleteCalendarEvent,
  listCalendarEvents,
  type RoutineBlockForCalendar,
} from '../client';

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

const CLIENT_ID = 'fake-client.apps.googleusercontent.com';
const fetchMock = jest.fn();

function blk(over: Partial<RoutineBlockForCalendar>): RoutineBlockForCalendar {
  return {
    id: 'blk-1',
    date: '2026-06-10',
    startTime: '09:00',
    endTime: '10:00',
    title: 'Deep Work',
    module: 'goal',
    ...over,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('syncBlocksToCalendar', () => {
  it('creates blocks without a calendarEventId and captures the new event id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'evt-new' }));

    const out = await syncBlocksToCalendar(CLIENT_ID, [blk({ id: 'blk-a' })]);

    expect(out.created).toBe(1);
    expect(out.updated).toBe(0);
    expect(out.failed).toBe(0);
    expect(out.eventIds).toEqual({ 'blk-a': 'evt-new' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('updates blocks that already carry a calendarEventId and reuses that id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const out = await syncBlocksToCalendar(CLIENT_ID, [
      blk({ id: 'blk-b', calendarEventId: 'evt-existing' }),
    ]);

    expect(out.updated).toBe(1);
    expect(out.created).toBe(0);
    expect(out.eventIds).toEqual({ 'blk-b': 'evt-existing' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(String(url)).toContain('/evt-existing');
  });

  it('routes a mixed batch and accumulates per-block failures without throwing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'evt-created' })) // create blk-1 ok
      .mockResolvedValueOnce(jsonResponse({}, false, 500)) // update blk-2 fails
      .mockResolvedValueOnce(jsonResponse({})); // update blk-3 ok

    const out = await syncBlocksToCalendar(CLIENT_ID, [
      blk({ id: 'blk-1' }),
      blk({ id: 'blk-2', calendarEventId: 'evt-2' }),
      blk({ id: 'blk-3', calendarEventId: 'evt-3' }),
    ]);

    expect(out.created).toBe(1);
    expect(out.updated).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toContain('500');
    // Only the successful blocks contribute event ids.
    expect(out.eventIds).toEqual({ 'blk-1': 'evt-created', 'blk-3': 'evt-3' });
  });
});

describe('deleteCalendarEvent', () => {
  it('swallows a 404 (event already gone)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));
    await expect(deleteCalendarEvent(CLIENT_ID, 'evt-x')).resolves.toBeUndefined();
  });

  it('swallows a 410 (event already gone)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 410));
    await expect(deleteCalendarEvent(CLIENT_ID, 'evt-y')).resolves.toBeUndefined();
  });

  it('throws a status-tagged error on a 500', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(deleteCalendarEvent(CLIENT_ID, 'evt-z')).rejects.toThrow('Delete event failed: 500');
  });

  it('resolves on a successful delete', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, true, 204));
    await expect(deleteCalendarEvent(CLIENT_ID, 'evt-ok')).resolves.toBeUndefined();
  });
});

describe('listCalendarEvents', () => {
  it('requests the events.list endpoint with singleEvents + startTime ordering and a time window', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await listCalendarEvents(CLIENT_ID);

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('GET');
    const u = String(url);
    expect(u).toContain('singleEvents=true');
    expect(u).toContain('orderBy=startTime');
    expect(u).toContain('timeMin=');
    expect(u).toContain('timeMax=');
  });

  it('parses a timed event into local times, epoch ms, and the self RSVP', async () => {
    const startISO = '2026-06-10T09:00:00Z';
    const endISO = '2026-06-10T09:30:00Z';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'evt-1',
            summary: 'Standup',
            status: 'confirmed',
            start: { dateTime: startISO },
            end: { dateTime: endISO },
            attendees: [
              { self: true, responseStatus: 'accepted' },
              { self: false, responseStatus: 'needsAction' },
            ],
          },
        ],
      }),
    );

    const [evt] = await listCalendarEvents(CLIENT_ID);

    expect(evt.id).toBe('evt-1');
    expect(evt.title).toBe('Standup');
    expect(evt.allDay).toBe(false);
    expect(evt.responseStatus).toBe('accepted');
    expect(evt.recurring).toBe(false);
    // Epoch ms are timezone-independent; assert those exactly.
    expect(evt.startMs).toBe(Date.parse(startISO));
    expect(evt.endMs).toBe(Date.parse(endISO));
    // Local HH:MM rendering must match the same local conversion (TZ-agnostic).
    const d = new Date(Date.parse(startISO));
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    expect(evt.startTime).toBe(expected);
  });

  it('treats date-only events as all-day with null times', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'evt-allday',
            summary: 'Conference',
            status: 'confirmed',
            start: { date: '2026-06-10' },
            end: { date: '2026-06-11' },
          },
        ],
      }),
    );

    const [evt] = await listCalendarEvents(CLIENT_ID);

    expect(evt.allDay).toBe(true);
    expect(evt.startTime).toBeNull();
    expect(evt.endTime).toBeNull();
    expect(evt.date).toBe('2026-06-10');
  });

  it('drops cancelled instances and events the user declined', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 'ok', summary: 'Keep', status: 'confirmed', start: { dateTime: '2026-06-10T08:00:00Z' }, end: { dateTime: '2026-06-10T08:30:00Z' } },
          { id: 'gone', summary: 'Cancelled', status: 'cancelled', start: { dateTime: '2026-06-10T09:00:00Z' }, end: { dateTime: '2026-06-10T09:30:00Z' } },
          { id: 'no', summary: 'Declined', status: 'confirmed', start: { dateTime: '2026-06-10T10:00:00Z' }, end: { dateTime: '2026-06-10T10:30:00Z' }, attendees: [{ self: true, responseStatus: 'declined' }] },
        ],
      }),
    );

    const events = await listCalendarEvents(CLIENT_ID);

    expect(events.map((e) => e.id)).toEqual(['ok']);
  });

  it('flags recurring instances and sorts by start time', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 'late', summary: 'Late', status: 'confirmed', start: { dateTime: '2026-06-10T15:00:00Z' }, end: { dateTime: '2026-06-10T15:30:00Z' } },
          { id: 'early', summary: 'Daily', status: 'confirmed', recurringEventId: 'rec-1', start: { dateTime: '2026-06-10T09:00:00Z' }, end: { dateTime: '2026-06-10T09:15:00Z' } },
        ],
      }),
    );

    const events = await listCalendarEvents(CLIENT_ID);

    expect(events.map((e) => e.id)).toEqual(['early', 'late']);
    expect(events[0].recurring).toBe(true);
    expect(events[1].recurring).toBe(false);
  });

  it('throws a status-tagged error on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(listCalendarEvents(CLIENT_ID)).rejects.toThrow('List events failed: 500');
  });
});
