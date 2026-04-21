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

## Next steps (not done yet)

- Add `jest-expo` preset so components + hooks can be tested
- Add `@testing-library/react-native` for the Rewards/Today/Goals screens
- Mock `expo-sqlite` + `expo-crypto` for DB query tests
- CI hook (GitHub Actions): `npm ci && npm test` on every push
