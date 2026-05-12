// Minimal `react-native` stub for the Node-only eval/test harness. Only the
// surfaces actually touched by src/ai/** and src/utils/** are stubbed.
export const Platform = { OS: 'node' as 'node' | 'web' | 'ios' | 'android' };
export const Linking = { openURL: async (_url: string) => undefined };
