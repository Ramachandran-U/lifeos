// Drive generateConversationStarters with a stubbed callAI so we can inspect the
// EXACT payload it sends — the privacy projection (PARKED §15.4) is the property
// under test: scoped personalization must never leak more than a first name +
// the last-interaction type, even if a full name is passed by mistake.
jest.mock('../client', () => ({ callAI: jest.fn() }));

import { callAI } from '../client';
import { generateConversationStarters } from '../functions';
import { buildMockConversationStarters } from '../mocks/social';

const callAIMock = callAI as jest.MockedFunction<typeof callAI>;
const VALID = JSON.stringify({ openers: ['a', 'b'] });

function sentPayload(): Record<string, unknown> {
  const arg = callAIMock.mock.calls[0][0] as { messages: { content: string }[] };
  return JSON.parse(arg.messages[0].content);
}

describe('generateConversationStarters — scoped privacy projection', () => {
  beforeEach(() => callAIMock.mockReset());

  it('reduces a full name to its first token and never sends the rest', async () => {
    callAIMock.mockResolvedValueOnce(VALID);
    await generateConversationStarters({
      relationshipType: 'close_friend',
      daysSinceContact: 40,
      firstName: 'Sam Rivera',
      lastInteractionType: 'message',
    });
    const payload = sentPayload();
    expect(payload.firstName).toBe('Sam');
    expect(payload.lastInteractionType).toBe('message');
    // The surname / full name must never leave the device.
    expect(JSON.stringify(payload)).not.toMatch(/Rivera/);
  });

  it('sends NO scoped fields in generic mode (flag off → they are simply not passed)', async () => {
    callAIMock.mockResolvedValueOnce(VALID);
    await generateConversationStarters({ relationshipType: 'mentor', daysSinceContact: 12 });
    const payload = sentPayload();
    expect(payload.firstName).toBeUndefined();
    expect(payload.lastInteractionType).toBeUndefined();
    expect(payload.relationshipType).toBe('mentor');
    expect(payload.daysSinceContact).toBe(12);
  });

  it('caps the context note and still carries no name in generic mode', async () => {
    callAIMock.mockResolvedValueOnce(VALID);
    await generateConversationStarters({
      relationshipType: 'family',
      daysSinceContact: 3,
      contextNote: 'x'.repeat(500),
    });
    const payload = sentPayload();
    expect((payload.contextNote as string).length).toBe(200);
    expect(payload.firstName).toBeUndefined();
  });
});

describe('buildMockConversationStarters — scoped personalization', () => {
  it('uses the first name in the lead opener when provided', () => {
    const res = buildMockConversationStarters({
      relationshipType: 'close_friend',
      daysSinceContact: 5,
      firstName: 'Priya',
    });
    expect(res.openers[0]).toMatch(/Priya/);
    expect(res.openers.length).toBeGreaterThanOrEqual(2);
  });

  it('reduces a full name to the first token in the mock too', () => {
    const res = buildMockConversationStarters({
      relationshipType: 'close_friend',
      daysSinceContact: 40,
      firstName: 'Priya Menon',
    });
    expect(res.openers[0]).toMatch(/Priya/);
    expect(res.openers[0]).not.toMatch(/Menon/);
  });

  it('stays generic (invents no name) when no first name is given', () => {
    const res = buildMockConversationStarters({ relationshipType: 'mentor', daysSinceContact: 45 });
    expect(res.openers[0]).not.toMatch(/Hey [A-Z][a-z]+ —/);
  });
});
