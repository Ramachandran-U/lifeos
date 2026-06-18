import { buildVoiceSystemInstruction } from '@/ai/prompts/voiceAgent';

// The agentic extension carries the ACT rules; the read-only base must stay
// grounding-only. These lock the reach-out drafting capability (PARKED §15.5)
// into the agentic prompt without leaking action guidance into read-only mode.
describe('voice agent prompt — reach-out drafting (15.5)', () => {
  const agentic = buildVoiceSystemInstruction({ agentic: true });
  const base = buildVoiceSystemInstruction({ agentic: false });

  it('agentic mode can draft a reach-out and then offer to log it', () => {
    expect(agentic).toMatch(/DRAFTING A REACH-OUT/);
    expect(agentic).toMatch(/getContacts/);
    expect(agentic).toMatch(/proposeLogContact/);
    // It must be framed as a suggestion that saves nothing.
    expect(agentic).toMatch(/saves nothing/i);
  });

  it('read-only base stays grounding-only — no act/draft guidance', () => {
    expect(base).not.toMatch(/DRAFTING A REACH-OUT/);
    expect(base).not.toMatch(/proposeLogContact/);
    expect(base.length).toBeLessThan(agentic.length);
  });
});
