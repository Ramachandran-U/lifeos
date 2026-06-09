/**
 * On-device retention bounds for the append-only `behaviour_events` analytics
 * table. Every read (`getEventsLastNDays`, usage stats, weekly insight) looks
 * back at most ~30 days, so anything older is dead weight — yet nothing pruned
 * it, so the table grew without bound on both web (shared localStorage quota)
 * and native (SQLite file). These two constants are the single source of truth
 * for the web ring-buffer prune (`webInsertBehaviourEvent`) and the native
 * boot-time prune (`initDatabase`).
 *
 * No imports here on purpose: this module is pulled in by both the web storage
 * layer and `db/index.ts`, and a dependency would risk an import cycle.
 */

/**
 * Days of `behaviour_events` history kept on-device. Reads never exceed a
 * 30-day window; 35 leaves a small margin so an off-by-a-day cutoff can't drop
 * an event a consumer still wants.
 */
export const BEHAVIOUR_RETENTION_DAYS = 35;

/**
 * Hard backstop on the number of `behaviour_events` rows held in web
 * localStorage, independent of age. A burst of events (e.g. rapid screen
 * navigation) can't blow the quota shared with the mutation log, flags, and
 * prompt cache before the age prune next runs. Mirrors the mutation-log
 * `WEB_CAP` convention in `src/sync/sink.ts`.
 */
export const BEHAVIOUR_WEB_CAP = 5000;

/**
 * Days of `xp_events` ledger history kept in web localStorage. The weekly-XP
 * derivation looks back ≤7 days and nothing on web reads further than ~90
 * (native keeps full history in SQLite; the synced mutation log preserves the
 * complete ledger for future server-side aggregation regardless of this prune).
 */
export const XP_EVENTS_RETENTION_DAYS = 95;

/** Hard row-count backstop for web `xp_events`, mirroring BEHAVIOUR_WEB_CAP. */
export const XP_EVENTS_WEB_CAP = 4000;
