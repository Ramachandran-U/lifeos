import { voiceToolTelemetryProps } from '@/ai/voiceToolTelemetry';

describe('voiceToolTelemetryProps', () => {
  it('marks ok and surfaces found/ambiguous booleans for a successful result', () => {
    const p = voiceToolTelemetryProps('getMoneyWithPayee', {
      result: { found: true, ambiguous: false, sentRupees: 800 },
    });
    expect(p).toEqual({ tool: 'getMoneyWithPayee', ok: true, found: true, ambiguous: false });
  });

  it('marks not-ok for an errored / unknown tool, with no result shape', () => {
    expect(voiceToolTelemetryProps('getMoneyWithPayee', { error: 'boom' })).toEqual({
      tool: 'getMoneyWithPayee',
      ok: false,
    });
  });

  it('omits found/ambiguous when the tool result does not report them', () => {
    expect(voiceToolTelemetryProps('getRecentSpending', { result: { totalSpentRupees: 1000 } })).toEqual({
      tool: 'getRecentSpending',
      ok: true,
    });
  });

  it('never leaks amounts, payee names, notes, or other free-text/result content', () => {
    const p = voiceToolTelemetryProps('getMoneyWithPayee', {
      result: {
        found: false,
        note: 'No payments to "Anjali" in this window',
        matchedPayees: ['Anjali Hari'],
        sentRupees: 800,
      },
    });
    expect(p).toEqual({ tool: 'getMoneyWithPayee', ok: true, found: false });
    expect(p).not.toHaveProperty('note');
    expect(p).not.toHaveProperty('matchedPayees');
    expect(p).not.toHaveProperty('sentRupees');
  });
});
