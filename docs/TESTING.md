# Testing

Minimal Jest + ts-jest setup for pure-logic tests. Component/integration tests need `jest-expo` later.

## Run

```bash
npm test             # single run
npm run test:watch   # watch mode
```

## Layout

Tests live next to the code they cover in `__tests__/` folders:

```
src/utils/__tests__/gamification.test.ts
src/finance/parsers/__tests__/emailParsers.test.ts
```

Config: [`jest.config.js`](../jest.config.js). Paths:
- `@/` → `src/`
- `testEnvironment: 'node'` (no DOM)
- `app/` and `src/components/` are ignored — RN JSX needs jest-expo.

## Coverage today

- **gamification.ts** — XP curve, streak grace logic, badge awards, domain score weighting
- **emailParsers.ts** — HDFC/ICICI/Axis regex + dispatcher

## Adding tests

1. Add the file under `<module>/__tests__/<name>.test.ts`.
2. Only import pure-logic modules (no `react-native`, no `expo-*`, no DB).
3. For time-dependent logic, use `date-fns` helpers with a `today()` helper rather than hard-coded strings.

## E2E (Playwright)

Happy-path browser tests for the web build live in [`e2e/`](../e2e/). Config: [`playwright.config.ts`](../playwright.config.ts).

```bash
# Terminal 1 — start the web build in mock mode
EXPO_PUBLIC_USE_AI_MOCK=true npx expo start --web

# Terminal 2
npx playwright test
```

Notes:
- `baseURL` is `http://localhost:8081`; start Expo web first.
- `EXPO_PUBLIC_USE_AI_MOCK=true` is required — specs assert mock-response content.
- RN-web renders `Pressable` as `generic` (not `role=button`); use `page.getByText(...)` selectors rather than `getByRole('button', ...)`.
- Auth/onboarding state is seeded directly into `localStorage` via `addInitScript` — see [`e2e/helpers.ts`](../e2e/helpers.ts).

Current specs:
- [`career-strategy.spec.ts`](../e2e/career-strategy.spec.ts) — Career Strategist: fill role form → Analyse → Generate strategy → Commit all → verify `W1:` goal appears on Goals tab.

## Next steps (not done yet)

- Add `jest-expo` preset so components + hooks can be tested
- Add `@testing-library/react-native` for the Rewards/Today/Goals screens
- Mock `expo-sqlite` + `expo-crypto` for DB query tests
- CI hook (GitHub Actions): `npm ci && npm test && npx playwright test` on every push
