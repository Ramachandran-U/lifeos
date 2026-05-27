/**
 * Web storage barrel — localStorage-backed substitute for SQLite on web.
 * Mirrors the shape of the native Drizzle query functions used by the app.
 * Each entity has its own module under `webStorage/`; this file re-exports
 * them so query files keep importing from `@/db/webStorage`.
 */

export * from './webStorage/users';
export * from './webStorage/userProfile';
export * from './webStorage/routine';
export * from './webStorage/gamification';
export * from './webStorage/reflections';
export * from './webStorage/discovery';
export * from './webStorage/chat';
export * from './webStorage/goals';
export * from './webStorage/health';
export * from './webStorage/finance';
export * from './webStorage/polymath';
export * from './webStorage/social';
export * from './webStorage/cognitiveInsights';
export * from './webStorage/expeditions';
