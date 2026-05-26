// Web stub — Metro's Expo web resolver picks this file over index.ts on web,
// preventing expo-sqlite from entering the bundle. All query files in
// src/db/queries/*.ts branch on Platform.OS === 'web' and delegate to
// src/db/webStorage.ts, so `db` is never touched at runtime on web.

export function getDB(): never {
  throw new Error('SQLite is not available on web');
}

// Accessing `db` on web would indicate a query forgot its web branch —
// throw loudly instead of silently returning no-ops that mask bugs.
export const db = new Proxy({} as never, {
  get() {
    throw new Error('db is not available on web — use webStorage helpers instead');
  },
}) as never;

export async function initDatabase(): Promise<void> {
  // Web uses the localStorage-backed webStorage layer; there's no SQLite to
  // migrate. Kept quiet in prod — only surfaces in dev. (BUG-008)
  if (__DEV__) console.debug('[db] web: using webStorage, skipping SQLite init');
}
