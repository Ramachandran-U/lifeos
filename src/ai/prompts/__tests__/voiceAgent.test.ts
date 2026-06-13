import { buildVoiceSystemInstruction } from '@/ai/prompts/voiceAgent';

describe('buildVoiceSystemInstruction', () => {
  it('read-only mode returns the grounding base with no act/navigate instructions', () => {
    const s = buildVoiceSystemInstruction({ agentic: false });
    expect(s).toContain('Digital Life Architect');
    expect(s).toMatch(/read-only tools/i);
    expect(s).not.toMatch(/navigat/i);
    expect(s).not.toMatch(/commitProposedActions/);
  });

  it('agentic mode appends the navigate / confirm / slot-filling instructions', () => {
    const base = buildVoiceSystemInstruction({ agentic: false });
    const agentic = buildVoiceSystemInstruction({ agentic: true });
    expect(agentic.startsWith(base)).toBe(true);
    expect(agentic.length).toBeGreaterThan(base.length);
    expect(agentic).toMatch(/navigateTo/);
    expect(agentic).toMatch(/confirm/i);
    expect(agentic).toMatch(/commitProposedActions/);
  });
});
