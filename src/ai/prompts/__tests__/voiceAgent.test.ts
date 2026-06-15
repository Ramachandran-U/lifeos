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

  it('agentic mode steers create flows through the propose tools, not bare navigation', () => {
    // The bug: the prompt told the model "add a goal → navigateTo 'goals' and keep
    // talking", which drafts nothing, so the goal/path never appeared. Creation
    // must route through the propose tools instead.
    const s = buildVoiceSystemInstruction({ agentic: true });
    expect(s).toMatch(/proposeCreateGoal/);
    expect(s).toMatch(/proposeGenerateCareerPath/);
    expect(s).toMatch(/not just navigation|NOT plain navigation/i);
  });

  it('agentic mode is honest that a confirmed create is a draft to review and Save', () => {
    const s = buildVoiceSystemInstruction({ agentic: true });
    expect(s).toMatch(/draft/i);
    expect(s).toMatch(/tap Save/i);
    // It must forbid claiming the item is saved/done before the user taps Save.
    expect(s).toMatch(/not saved until/i);
    expect(s).toMatch(/never say it'?s added/i);
  });
});
