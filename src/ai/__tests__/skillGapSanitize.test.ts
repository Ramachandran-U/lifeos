import { SkillGapAnalysisSchema } from '../types';

// Re-import the sanitizer indirectly by exercising analyseSkillGap with a
// stubbed callAI. We can't import the un-exported helper, so we drive the
// whole function path and verify it parses outputs that Gemini routinely
// produces in slightly non-canonical shapes.

jest.mock('../client', () => ({
  callAI: jest.fn(),
}));

import { callAI } from '../client';
import { analyseSkillGap } from '../functions';

const callAIMock = callAI as jest.MockedFunction<typeof callAI>;

const baseInput = {
  currentRole: 'Junior Dev',
  targetRole: 'Senior Dev',
  timelineMonths: 12,
  currentSkills: ['JavaScript', 'React'],
};

describe('analyseSkillGap — defensive sanitization', () => {
  beforeEach(() => callAIMock.mockReset());

  it('coerces hallucinated currentLevel values (novice → beginner, expert → advanced)', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      gaps: [
        { skill: 'System Design', currentLevel: 'novice', requiredLevel: 'advanced', priority: 1 },
        { skill: 'Leadership', currentLevel: 'expert', requiredLevel: 'master', priority: 2 },
      ],
      resources: [
        { title: 'Designing Data-Intensive Apps', type: 'book', estimatedHours: 30 },
      ],
    }));
    const result = await analyseSkillGap(baseInput);
    expect(result.gaps[0].currentLevel).toBe('beginner');
    expect(result.gaps[1].currentLevel).toBe('advanced');
    expect(result.gaps[1].requiredLevel).toBe('expert');
    expect(() => SkillGapAnalysisSchema.parse(result)).not.toThrow();
  });

  it('coerces hallucinated resource types (video → course, article → book, mentor → person)', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      gaps: [
        { skill: 'Observability', currentLevel: 'beginner', requiredLevel: 'intermediate', priority: 3 },
      ],
      resources: [
        { title: 'OpenTelemetry intro', type: 'video', estimatedHours: 2 },
        { title: 'SRE handbook chapters', type: 'article', estimatedHours: 8 },
        { title: 'Find a staff engineer mentor', type: 'mentor', estimatedHours: 4 },
      ],
    }));
    const result = await analyseSkillGap(baseInput);
    expect(result.resources[0].type).toBe('course');
    expect(result.resources[1].type).toBe('book');
    expect(result.resources[2].type).toBe('person');
  });

  it('coerces string priority labels (high/medium/low) and string hour counts to numbers', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      gaps: [
        { skill: 'A', currentLevel: 'beginner', requiredLevel: 'advanced', priority: 'high' },
        { skill: 'B', currentLevel: 'intermediate', requiredLevel: 'expert', priority: 'medium' },
        { skill: 'C', currentLevel: 'none', requiredLevel: 'beginner', priority: 'low' },
      ],
      resources: [
        { title: 'X', type: 'course', estimatedHours: '20' },
      ],
    }));
    const result = await analyseSkillGap(baseInput);
    expect(result.gaps[0].priority).toBe(1);
    expect(result.gaps[1].priority).toBe(2);
    expect(result.gaps[2].priority).toBe(3);
    expect(result.resources[0].estimatedHours).toBe(20);
  });

  it('handles valid input cleanly (no coercion needed)', async () => {
    const valid = {
      gaps: [
        { skill: 'Design Patterns', currentLevel: 'beginner', requiredLevel: 'advanced', priority: 1 },
      ],
      resources: [
        { title: 'Refactoring (Fowler)', type: 'book', estimatedHours: 40 },
      ],
    };
    callAIMock.mockResolvedValueOnce(JSON.stringify(valid));
    const result = await analyseSkillGap(baseInput);
    expect(result.gaps[0]).toEqual(valid.gaps[0]);
    expect(result.resources[0]).toEqual(valid.resources[0]);
  });

  it('still throws on truly malformed output (not even JSON)', async () => {
    callAIMock.mockResolvedValueOnce('completely not json {[}');
    await expect(analyseSkillGap(baseInput)).rejects.toThrow(/AI returned invalid|JSON|SkillGap/i);
  });
});
