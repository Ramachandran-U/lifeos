describe('parseSpokenMeal', () => {
  const prevEnv = process.env.EXPO_PUBLIC_USE_AI_MOCK;

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_AI_MOCK = prevEnv;
    jest.resetModules();
  });

  it('returns the food-recognition mock in mock mode (no network call)', async () => {
    process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true';
    jest.resetModules();
    const { parseSpokenMeal } = await import('../voiceFood');
    const { MOCK_FOOD_RECOGNITION } = await import('../mocks/health');

    const result = await parseSpokenMeal('two eggs, a slice of toast and a black coffee');
    expect(result).toEqual(MOCK_FOOD_RECOGNITION);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('ships a non-empty system prompt that requests JSON', async () => {
    const { SPOKEN_MEAL_PROMPT } = await import('../voiceFood');
    expect(SPOKEN_MEAL_PROMPT).toMatch(/JSON/i);
    expect(SPOKEN_MEAL_PROMPT.length).toBeGreaterThan(100);
  });
});
