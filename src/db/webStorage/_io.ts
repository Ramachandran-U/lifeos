/**
 * Shared localStorage helpers for the per-entity web stores. Every entity
 * stores a JSON-encoded array of records under its own key.
 */

export function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export function save<T>(key: string, records: T[]): void {
  localStorage.setItem(key, JSON.stringify(records));
}
