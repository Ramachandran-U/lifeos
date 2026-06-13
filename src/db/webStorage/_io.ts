/**
 * Shared localStorage helpers for the per-entity web stores. Every entity
 * stores a JSON-encoded array of records under its own key.
 */

/**
 * Thrown when a localStorage write is rejected for exceeding the origin quota
 * (~5 MB). Previously the raw `DOMException` propagated uncaught — crashing the
 * write and, for the single `lifeos_users` blob, wedging every later profile
 * write. A typed error lets callers (e.g. the avatar save) degrade gracefully.
 */
export class StorageQuotaError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`Storage is full — could not save "${key}". Free up space and try again.`);
    this.name = 'StorageQuotaError';
    this.key = key;
  }
}

function isQuotaExceeded(e: unknown): boolean {
  // Chrome/Safari: name 'QuotaExceededError' / code 22.
  // Firefox: 'NS_ERROR_DOM_QUOTA_REACHED' / code 1014.
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; code?: number };
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

export function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export function save<T>(key: string, records: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch (e) {
    if (isQuotaExceeded(e)) throw new StorageQuotaError(key);
    throw e;
  }
}
