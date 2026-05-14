import { load, save } from './_io';
import { DISCOVERY_IMPORTS_KEY } from './_keys';

export interface WebDiscoveryImport {
  id: string;
  userId: string;
  rawText: string;
  extracted: string; // JSON
  createdAt: string;
}

export function webInsertDiscoveryImport(r: WebDiscoveryImport): void {
  const all = load<WebDiscoveryImport>(DISCOVERY_IMPORTS_KEY);
  all.push(r);
  save(DISCOVERY_IMPORTS_KEY, all);
}

export function webGetLatestDiscoveryImport(userId: string): WebDiscoveryImport | undefined {
  return load<WebDiscoveryImport>(DISCOVERY_IMPORTS_KEY)
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
