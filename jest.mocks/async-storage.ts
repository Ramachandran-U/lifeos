// In-memory AsyncStorage shim — adequate for eval/test runs that don't need
// cross-test persistence.
const store: Record<string, string> = {};
const AsyncStorage = {
  getItem: async (k: string): Promise<string | null> => store[k] ?? null,
  setItem: async (k: string, v: string): Promise<void> => {
    store[k] = v;
  },
  removeItem: async (k: string): Promise<void> => {
    delete store[k];
  },
  clear: async (): Promise<void> => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
export default AsyncStorage;
