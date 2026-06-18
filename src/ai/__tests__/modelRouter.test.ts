import { pickProvider, pickMaxTokens, pickModel, MODELS } from '../modelRouter';

describe('pickProvider (cheap-tier provider routing)', () => {
  const ORIG = process.env.EXPO_PUBLIC_CHEAP_PROVIDER;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.EXPO_PUBLIC_CHEAP_PROVIDER;
    else process.env.EXPO_PUBLIC_CHEAP_PROVIDER = ORIG;
  });

  it('returns undefined for every task when the env is unset (off by default)', () => {
    delete process.env.EXPO_PUBLIC_CHEAP_PROVIDER;
    expect(pickProvider('categorizeMerchant')).toBeUndefined();
    expect(pickProvider('generateRoutine')).toBeUndefined();
    expect(pickProvider(undefined)).toBeUndefined();
  });

  it('routes ONLY cheap-tier tasks to the configured provider', () => {
    process.env.EXPO_PUBLIC_CHEAP_PROVIDER = 'groq';
    // cheap tier → routed
    expect(pickProvider('categorizeMerchant')).toBe('groq');
    expect(pickProvider('generateDailyBriefing')).toBe('groq');
    expect(pickProvider('generateRabbitHoleNode')).toBe('groq');
    expect(pickProvider('agent.brief')).toBe('groq');
    // planning / reasoning → left on the default provider
    expect(pickProvider('generateRoutine')).toBeUndefined();
    expect(pickProvider('agent.whatNext')).toBeUndefined();
    expect(pickProvider('parseBloodReport')).toBeUndefined();
    expect(pickProvider('generateAnnualReview')).toBeUndefined();
  });

  it('treats an unknown/absent task as planning (not routed)', () => {
    process.env.EXPO_PUBLIC_CHEAP_PROVIDER = 'groq';
    expect(pickProvider(undefined)).toBeUndefined();
    expect(pickProvider('not-a-real-task')).toBeUndefined();
  });
});

describe('pickMaxTokens (per-task output budget default)', () => {
  it('falls back to the cheap tier cap for cheap tasks without an override', () => {
    expect(pickMaxTokens('categorizeMerchant')).toBe(768);
    expect(pickMaxTokens('generateDailyBriefing')).toBe(768);
  });

  it('uses the long-form overrides so reports are not truncated when maxTokens is omitted', () => {
    expect(pickMaxTokens('generateAnnualReview')).toBe(3072);
    expect(pickMaxTokens('generateWeekRoutine')).toBe(3072);
    expect(pickMaxTokens('generateRoutine')).toBe(2048);
  });

  it('defaults to the planning tier for unknown/absent tasks', () => {
    expect(pickMaxTokens(undefined)).toBe(1200);
    expect(pickMaxTokens('agent.whatNext')).toBe(1200);
    expect(pickMaxTokens('not-a-real-task')).toBe(1200);
  });
});

describe('pickModel (per-task model selection)', () => {
  const ORIG = process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
    else process.env.EXPO_PUBLIC_MODEL_OVERRIDE = ORIG;
  });

  it('routes each tier to its configured model', () => {
    delete process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
    expect(pickModel('categorizeMerchant')).toBe(MODELS.cheap); // cheap tier
    expect(pickModel('generateRoutine')).toBe(MODELS.planning); // planning tier
    expect(pickModel('parseBloodReport')).toBe(MODELS.reasoning); // reasoning tier
  });

  it('honours EXPO_PUBLIC_MODEL_OVERRIDE for every task (eval/benchmark hook)', () => {
    process.env.EXPO_PUBLIC_MODEL_OVERRIDE = 'gemini-3.1-flash-live-preview';
    expect(pickModel('categorizeMerchant')).toBe('gemini-3.1-flash-live-preview');
    expect(pickModel('parseBloodReport')).toBe('gemini-3.1-flash-live-preview');
  });

  it('every routed model is a gemini-* id (the worker only honours gemini-*)', () => {
    delete process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
    for (const model of Object.values(MODELS)) expect(model).toMatch(/^gemini-/);
    for (const task of ['categorizeMerchant', 'generateRoutine', 'parseBloodReport', 'agent.whatNext'] as const) {
      expect(pickModel(task)).toMatch(/^gemini-/);
    }
  });
});
