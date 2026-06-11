/**
 * CareerPathHero — Ink + Signal §3.3 / AC4 / C4-15 (unit half).
 *
 * Covers the three committed hero states with their exact strings — AC4's four
 * sample-route literals are asserted byte-verbatim — the R4 amendment (display
 * numerals in c.careerText in BOTH themes), the 4px raw-domain-token left
 * border in both themes, and the no-idle-motion rule (zero withRepeat in the
 * source — the screen owns the single hero-budget entry).
 */

import * as fs from 'fs';
import * as path from 'path';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CareerPathHero } from '@/components/modules/career/CareerPathHero';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { darkColors, lightColors } from '@/theme/colors';
import type { SkillGapAnalysis } from '@/ai/types';
import type { SavedCareerPath } from '@/db/careerStorage';

const analysis: SkillGapAnalysis = {
  gaps: [
    // 25 + 50 have of 100 + 100 need → 75/200 → 38%
    { skill: 'System design', currentLevel: 'beginner', requiredLevel: 'expert', priority: 1 },
    { skill: 'Mentoring', currentLevel: 'intermediate', requiredLevel: 'expert', priority: 2 },
  ],
  resources: [],
};

const savedPath: SavedCareerPath = {
  id: 'cp_1',
  name: 'Staff track',
  currentRole: 'Senior Engineer',
  targetRole: 'Staff Engineer',
  timelineMonths: 24,
  currentSkills: ['TypeScript'],
  analysis,
  savedAt: '2026-06-01T10:00:00.000Z',
};

const baseProps = {
  currentRole: 'Senior Engineer',
  targetRole: 'Staff Engineer',
  analysis: null,
  latestSavedPath: null,
  onMapPath: jest.fn(),
  onResumePath: jest.fn(),
  onStartNew: jest.fn(),
};

afterEach(() => {
  usePreferencesStore.setState({ theme: 'dark' });
  jest.clearAllMocks();
});

describe('CareerPathHero — state A, zero career data (§3.3 / AC4)', () => {
  it('renders the value promise with exact strings', () => {
    render(<CareerPathHero {...baseProps} />);
    expect(screen.getByText('Your next role has a route.')).toBeTruthy();
    expect(
      screen.getByText(
        'Name the destination. LifeOS maps the skill gaps, the learning path, and the weekly artifacts that get you there.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Map my path')).toBeTruthy();
  });

  it("renders AC4's four sample-route literals byte-verbatim, before any tap", () => {
    render(<CareerPathHero {...baseProps} />);
    expect(screen.getByText('Sample route · Senior Engineer → Staff Engineer · 12 wk')).toBeTruthy();
    expect(screen.getByText('Wk 1 — Ship a system-design one-pager')).toBeTruthy();
    expect(screen.getByText('Wk 5 — Lead a cross-team design review')).toBeTruthy();
    expect(screen.getByText('Wk 12 — Case study: a measurable production win')).toBeTruthy();
  });

  it('fires onMapPath from the CTA (the sheet trigger — no form renders here)', () => {
    render(<CareerPathHero {...baseProps} />);
    fireEvent.press(screen.getByText('Map my path'));
    expect(baseProps.onMapPath).toHaveBeenCalledTimes(1);
  });
});

describe('CareerPathHero — state B, saved paths exist (§3.3)', () => {
  const propsB = { ...baseProps, currentRole: '', targetRole: '', latestSavedPath: savedPath };

  it('renders the most recent saved path with the committed copy shape', () => {
    render(<CareerPathHero {...propsB} />);
    expect(screen.getByText('Senior Engineer → Staff Engineer')).toBeTruthy();
    expect(
      screen.getByText(`Saved ${new Date(savedPath.savedAt).toLocaleDateString()} · 2 yr`),
    ).toBeTruthy();
    expect(screen.getByText('Resume this path')).toBeTruthy();
    expect(screen.getByText('Start a new one')).toBeTruthy();
    // The sample route belongs to state A only.
    expect(screen.queryByText(/Sample route/)).toBeNull();
  });

  it('fires onResumePath with the path, and onStartNew from the quiet action', () => {
    render(<CareerPathHero {...propsB} />);
    fireEvent.press(screen.getByText('Resume this path'));
    expect(baseProps.onResumePath).toHaveBeenCalledWith(savedPath);
    fireEvent.press(screen.getByText('Start a new one'));
    expect(baseProps.onStartNew).toHaveBeenCalledTimes(1);
  });
});

describe('CareerPathHero — state C, analysis loaded (§3.3)', () => {
  const propsC = { ...baseProps, analysis };

  it('renders the roles, the real-progress display numeral and its caption', () => {
    render(<CareerPathHero {...propsC} />);
    expect(screen.getByText('Senior Engineer → Staff Engineer')).toBeTruthy();
    // (25 + 50) / (100 + 100) → 38% — the legacy computation moved verbatim.
    expect(screen.getByText('38%')).toBeTruthy();
    expect(screen.getByText('38% of the way there')).toBeTruthy();
    // No state A/B surfaces leak in.
    expect(screen.queryByText(/Sample route/)).toBeNull();
    expect(screen.queryByText('Resume this path')).toBeNull();
  });

  it('keeps the legacy empty-gaps caption (no fake percentage)', () => {
    const empty: SkillGapAnalysis = { ...analysis, gaps: [] };
    render(<CareerPathHero {...propsC} analysis={empty} />);
    expect(screen.getByText('Add your current skills to track progress')).toBeTruthy();
  });
});

describe('CareerPathHero — theme contract (R4 / C4-15 unit half)', () => {
  const numeralColor = () => {
    const el = screen.getByText('38%');
    return StyleSheet.flatten(el.props.style).color;
  };

  it('display numeral resolves to c.careerText on the dark theme', () => {
    usePreferencesStore.setState({ theme: 'dark' });
    render(<CareerPathHero {...baseProps} analysis={analysis} />);
    expect(numeralColor()).toBe(darkColors.careerText);
  });

  it('display numeral resolves to c.careerText on the light theme (NOT textPrimary)', () => {
    usePreferencesStore.setState({ theme: 'light' });
    render(<CareerPathHero {...baseProps} analysis={analysis} />);
    expect(numeralColor()).toBe(lightColors.careerText);
    expect(numeralColor()).not.toBe(lightColors.textPrimary);
  });

  it('keeps the 4px raw career-token left border in both themes, in all three states', () => {
    const stateProps = [
      { ...baseProps }, // A
      { ...baseProps, latestSavedPath: savedPath }, // B
      { ...baseProps, analysis }, // C
    ];
    for (const theme of ['dark', 'light'] as const) {
      usePreferencesStore.setState({ theme });
      for (const props of stateProps) {
        const tree = render(<CareerPathHero {...props} />);
        const json = tree.toJSON() as { props: { style: StyleProp<ViewStyle> } };
        const style = StyleSheet.flatten(json.props.style);
        expect(style.borderLeftWidth).toBe(4);
        // The domain hue is fixed across themes — the raw token, no alpha suffix.
        expect(style.borderLeftColor).toBe(darkColors.career);
        tree.unmount();
      }
    }
  });
});

describe('CareerPathHero — rest quiet (§3.0.6)', () => {
  it('the source carries zero withRepeat (no idle loops in the hero)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'CareerPathHero.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/withRepeat/);
  });
});
