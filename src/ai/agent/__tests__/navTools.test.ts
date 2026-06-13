import { buildNavTools } from '@/ai/agent/navTools';
import type { AppScreen, ToolContext } from '@/ai/agent/tools';

function findTool(tools: ReturnType<typeof buildNavTools>, name: string) {
  const tool = tools.find((t) => t.declaration.name === name);
  if (!tool) throw new Error(`${name} tool not found`);
  return tool;
}

describe('buildNavTools', () => {
  it('exposes nothing without navigate/currentScreen in context', () => {
    expect(buildNavTools({ userId: 'u1' })).toEqual([]);
  });

  it('exposes navigateTo + getCurrentScreen when wired', () => {
    const ctx: ToolContext = {
      userId: 'u1',
      navigate: () => {},
      currentScreen: () => 'today',
    };
    const names = buildNavTools(ctx).map((t) => t.declaration.name);
    expect(names).toEqual(expect.arrayContaining(['navigateTo', 'getCurrentScreen']));
  });

  describe('navigateTo', () => {
    it('navigates to a valid screen and reports it', () => {
      const calls: AppScreen[] = [];
      const tools = buildNavTools({ userId: 'u1', navigate: (s) => calls.push(s) });
      const res = findTool(tools, 'navigateTo').execute({ screen: 'health' });
      expect(res).toEqual({ navigated: true, screen: 'health' });
      expect(calls).toEqual(['health']);
    });

    it('rejects an unknown screen without navigating', () => {
      const calls: AppScreen[] = [];
      const tools = buildNavTools({ userId: 'u1', navigate: (s) => calls.push(s) });
      const res = findTool(tools, 'navigateTo').execute({ screen: 'nonsense' }) as {
        navigated: boolean;
        error?: string;
      };
      expect(res.navigated).toBe(false);
      expect(res.error).toMatch(/one of/);
      expect(calls).toEqual([]);
    });
  });

  describe('getCurrentScreen', () => {
    it('returns the live current screen', () => {
      let here: AppScreen = 'today';
      const tools = buildNavTools({ userId: 'u1', currentScreen: () => here });
      const tool = findTool(tools, 'getCurrentScreen');
      expect(tool.execute({})).toEqual({ screen: 'today' });
      here = 'career';
      expect(tool.execute({})).toEqual({ screen: 'career' });
    });
  });
});
