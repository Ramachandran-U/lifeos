import { Platform } from 'react-native';
import { desc, eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { discoveryImports } from '../schema';
import {
  webInsertDiscoveryImport,
  webGetLatestDiscoveryImport,
  type WebDiscoveryImport,
} from '../webStorage';
import type { DiscoveryExtraction } from '@/ai/types';

const isWeb = Platform.OS === 'web';

export interface DiscoveryImport {
  id: string;
  userId: string;
  rawText: string;
  extracted: DiscoveryExtraction;
  createdAt: string;
}

export function saveDiscoveryImport(userId: string, rawText: string, extracted: DiscoveryExtraction): string {
  const id = nanoid();
  const createdAt = new Date().toISOString();
  const record: WebDiscoveryImport = {
    id,
    userId,
    rawText,
    extracted: JSON.stringify(extracted),
    createdAt,
  };
  if (isWeb) {
    webInsertDiscoveryImport(record);
    return id;
  }
  db.insert(discoveryImports).values({
    id,
    userId,
    rawText,
    extracted: JSON.stringify(extracted),
    createdAt,
  }).run();
  return id;
}

export function getLatestDiscoveryImport(userId: string): DiscoveryImport | null {
  const parse = (r: WebDiscoveryImport): DiscoveryImport | null => {
    try {
      return { ...r, extracted: JSON.parse(r.extracted) as DiscoveryExtraction };
    } catch {
      return null;
    }
  };
  if (isWeb) {
    const r = webGetLatestDiscoveryImport(userId);
    return r ? parse(r) : null;
  }
  const rows = db.select().from(discoveryImports)
    .where(eq(discoveryImports.userId, userId))
    .orderBy(desc(discoveryImports.createdAt))
    .limit(1)
    .all();
  return rows[0] ? parse(rows[0] as WebDiscoveryImport) : null;
}
