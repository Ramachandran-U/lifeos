# Web vs Native Storage

LifeOS runs on iOS, Android, **and web** (`npx expo start` → press `w`). SQLite via `expo-sqlite` doesn't work on web, so every storage path branches on `Platform.OS === 'web'`.

## Rule

Every file in `src/db/queries/*` has this shape:

```ts
import { Platform } from 'react-native';
const isWeb = Platform.OS === 'web';

export function getX(...) {
  if (isWeb) return webGetX(...);   // localStorage or Dexie
  return db.select()...              // Drizzle + SQLite
}
```

## Storage matrix

| Entity | Native | Web |
|--------|--------|-----|
| Users, session | SQLite (Drizzle) | localStorage (`src/db/webStorage/users.ts`) |
| Goals, routine, health, gamification, etc. | SQLite | localStorage (one module per entity under `src/db/webStorage/`) |
| Career path snapshots | localStorage (both) | localStorage (`src/db/careerStorage.ts`) |
| Transactions (finance) | — (web-only feature currently) | IndexedDB / Dexie (`src/finance/db/transactionDb.ts`) |
| Theme preference | AsyncStorage | localStorage |
| Auth hash + salt | SQLite users row | localStorage user record |

## Adding a new entity

1. Define Drizzle table in `src/db/schema.ts`.
2. Write native queries (Drizzle) in `src/db/queries/<entity>.ts`.
3. Add a per-entity module `src/db/webStorage/<entity>.ts` with a localStorage mirror (use the shared `load`/`save` helpers in `_io.ts`), then export it from the `src/db/webStorage.ts` barrel.
4. Export a single API that branches on `isWeb` — callers never see the difference.

## Common mistakes

- Calling Drizzle directly from a component → breaks web build.
- Forgetting to serialize JSON fields to strings before writing to localStorage (native SQLite stores them as text too, so keep strings everywhere).
- Using `expo-sqlite` APIs at module top-level — they throw on web. Guard or lazy-init.
