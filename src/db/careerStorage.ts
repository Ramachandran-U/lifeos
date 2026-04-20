/**
 * Career path persistence — localStorage on web, mirrors the webStorage pattern.
 * Stores named career path snapshots so users can save, load, and manage multiple paths.
 */

import { Platform } from 'react-native';
import type { SkillGapAnalysis } from '@/ai/types';

const PATHS_KEY = 'lifeos_career_paths';

export interface SavedCareerPath {
  id: string;
  name: string;
  currentRole: string;
  targetRole: string;
  timelineMonths: number;
  currentSkills: string[];
  analysis: SkillGapAnalysis;
  savedAt: string; // ISO string
}

function load(): SavedCareerPath[] {
  if (Platform.OS !== 'web') return [];
  try {
    return JSON.parse(localStorage.getItem(PATHS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(paths: SavedCareerPath[]): void {
  if (Platform.OS !== 'web') return;
  localStorage.setItem(PATHS_KEY, JSON.stringify(paths));
}

export function getAllCareerPaths(): SavedCareerPath[] {
  return load();
}

export function saveCareerPath(path: Omit<SavedCareerPath, 'id' | 'savedAt'>): SavedCareerPath {
  const paths = load();
  const newPath: SavedCareerPath = {
    ...path,
    id: `cp_${Date.now()}`,
    savedAt: new Date().toISOString(),
  };
  save([...paths, newPath]);
  return newPath;
}

export function deleteCareerPath(id: string): void {
  save(load().filter((p) => p.id !== id));
}

export function updateCareerPathName(id: string, name: string): void {
  save(load().map((p) => (p.id === id ? { ...p, name } : p)));
}
