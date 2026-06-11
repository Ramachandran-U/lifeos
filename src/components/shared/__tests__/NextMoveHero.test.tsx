/**
 * NextMoveHero — exact state copy (§3.2), compassion strings (Acceptance #9)
 * and telemetry once-per-kind:title semantics (Acceptance #13).
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockTrack = jest.fn();
jest.mock('@/utils/telemetry', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  EVENTS: {
    nextMoveShown: 'next_move_shown',
    nextMoveCompleted: 'next_move_completed',
  },
}));

import { NextMoveHero } from '@/components/shared/NextMoveHero';
import type { NextMove } from '@/hooks/useNextMove';

const futureBlock: NextMove = {
  kind: 'block',
  title: 'Outline the mobile app launch doc',
  module: 'career',
  radarKey: 'career',
  startTime: '14:00',
  endTime: '15:00',
  upNow: false,
};

const upNowBlock: NextMove = { ...futureBlock, upNow: true };

const task: NextMove = {
  kind: 'task',
  title: 'Email the venue',
  module: 'goal',
  radarKey: 'goals',
  extraCount: 2,
};

const dayDone: NextMove = { kind: 'dayDone', title: 'Every block done. Outstanding.' };
const plan: NextMove = { kind: 'plan', title: "Let's build your first day." };

const noop = () => undefined;

function renderHero(move: NextMove, over: Partial<Parameters<typeof NextMoveHero>[0]> = {}) {
  return render(
    <NextMoveHero
      move={move}
      completedCount={5}
      blockCount={5}
      onPrimary={noop}
      onSecondary={noop}
      {...over}
    />,
  );
}

type Instance = ReturnType<typeof render>['root'];

/** Every string the user can actually read in the rendered tree. */
function renderedStrings(tree: Instance): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
  };
  tree.findAll(() => true).forEach((n: Instance) => walk((n.props as { children?: unknown }).children));
  return out.join(' ');
}

afterEach(() => jest.clearAllMocks());

describe('NextMoveHero — exact copy per state', () => {
  it('future block: NEXT eyebrow with time + domain, title verbatim, duration meta, both actions', () => {
    renderHero(futureBlock);
    expect(screen.getByText('NEXT · 14:00 · CAREER')).toBeTruthy();
    expect(screen.getByText('Outline the mobile app launch doc')).toBeTruthy();
    expect(screen.getByText('1 h')).toBeTruthy();
    expect(screen.getByText('Mark done')).toBeTruthy();
    expect(screen.getByText('Show my plan')).toBeTruthy();
    expect(screen.getByTestId('next-move-primary')).toBeTruthy();
    expect(screen.getByTestId('next-move-secondary')).toBeTruthy();
  });

  it('up-now block: UP NOW eyebrow — never anything harsher', () => {
    renderHero(upNowBlock);
    expect(screen.getByText('UP NOW · CAREER')).toBeTruthy();
  });

  it('task: NEXT · GOALS eyebrow, plural meta, Open in Goals secondary', () => {
    renderHero(task);
    expect(screen.getByText('NEXT · GOALS')).toBeTruthy();
    expect(screen.getByText('Email the venue')).toBeTruthy();
    expect(screen.getByText('+2 more tasks today')).toBeTruthy();
    expect(screen.getByText('Mark done')).toBeTruthy();
    expect(screen.getByText('Open in Goals')).toBeTruthy();
  });

  it('task: singular meta at extraCount 1; meta omitted at extraCount 0', () => {
    renderHero({ ...task, extraCount: 1 });
    expect(screen.getByText('+1 more task today')).toBeTruthy();
    screen.unmount();
    renderHero({ ...task, extraCount: 0 });
    expect(screen.queryByText(/more task/)).toBeNull();
  });

  it('plan: DAY ONE eyebrow, exact headline + meta, Plan my day, no secondary', () => {
    renderHero(plan);
    expect(screen.getByText('DAY ONE')).toBeTruthy();
    expect(screen.getByText("Let's build your first day.")).toBeTruthy();
    expect(screen.getByText('Three questions, one plan. Two minutes.')).toBeTruthy();
    expect(screen.getByText('Plan my day')).toBeTruthy();
    expect(screen.queryByTestId('next-move-secondary')).toBeNull();
  });

  it('dayDone: dynamic ALL CLEAR count, exact headline, See your day, no meta/secondary', () => {
    renderHero(dayDone, { completedCount: 3, blockCount: 3 });
    expect(screen.getByText('ALL CLEAR · 3/3')).toBeTruthy();
    expect(screen.getByText('Every block done. Outstanding.')).toBeTruthy();
    expect(screen.getByText('See your day')).toBeTruthy();
    expect(screen.queryByTestId('next-move-secondary')).toBeNull();
  });

  it('block duration formula: minutes, whole hours, and mixed', () => {
    renderHero({ ...futureBlock, startTime: '14:00', endTime: '14:45' });
    expect(screen.getByText('45 min')).toBeTruthy();
    screen.unmount();
    renderHero({ ...futureBlock, startTime: '14:00', endTime: '16:00' });
    expect(screen.getByText('2 h')).toBeTruthy();
    screen.unmount();
    renderHero({ ...futureBlock, startTime: '14:00', endTime: '15:30' });
    expect(screen.getByText('1 h 30 min')).toBeTruthy();
  });
});

describe('NextMoveHero — compassion (Acceptance #9)', () => {
  it.each([
    ['future block', futureBlock],
    ['up-now block', upNowBlock],
    ['task', task],
    ['dayDone', dayDone],
    ['plan', plan],
  ] as Array<[string, NextMove]>)(
    '%s: rendered output has no overdue/late/missed/streak/XP strings',
    (_label, move) => {
      const { root } = renderHero(move);
      const text = renderedStrings(root);
      for (const banned of ['overdue', 'late', 'missed', 'streak', 'XP']) {
        expect(text).not.toContain(banned);
      }
    },
  );
});

describe('NextMoveHero — telemetry (Acceptance #13)', () => {
  it('fires next_move_shown exactly once on mount with { kind, module }', () => {
    renderHero(futureBlock);
    const shown = mockTrack.mock.calls.filter((c) => c[0] === 'next_move_shown');
    expect(shown).toHaveLength(1);
    expect(shown[0][1]).toEqual({ kind: 'block', module: 'career' });
  });

  it('re-render with unchanged kind:title fires nothing more', () => {
    const view = renderHero(futureBlock);
    view.rerender(
      <NextMoveHero
        move={{ ...futureBlock }}
        completedCount={5}
        blockCount={5}
        onPrimary={noop}
        onSecondary={noop}
      />,
    );
    const shown = mockTrack.mock.calls.filter((c) => c[0] === 'next_move_shown');
    expect(shown).toHaveLength(1);
  });

  it('a kind:title change fires next_move_shown again (cross-fade re-key)', () => {
    const view = renderHero(futureBlock);
    view.rerender(
      <NextMoveHero
        move={task}
        completedCount={5}
        blockCount={5}
        onPrimary={noop}
        onSecondary={noop}
      />,
    );
    const shown = mockTrack.mock.calls.filter((c) => c[0] === 'next_move_shown');
    expect(shown).toHaveLength(2);
    expect(shown[1][1]).toEqual({ kind: 'task', module: 'goal' });
  });

  it('one primary press in block state fires next_move_completed exactly once and calls onPrimary', () => {
    const onPrimary = jest.fn();
    renderHero(futureBlock, { onPrimary });
    fireEvent.press(screen.getByTestId('next-move-primary'));
    const completed = mockTrack.mock.calls.filter((c) => c[0] === 'next_move_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0][1]).toEqual({ kind: 'block', module: 'career' });
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('primary press in plan/dayDone states fires no next_move_completed', () => {
    renderHero(plan);
    fireEvent.press(screen.getByTestId('next-move-primary'));
    screen.unmount();
    renderHero(dayDone);
    fireEvent.press(screen.getByTestId('next-move-primary'));
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'next_move_completed')).toHaveLength(0);
  });
});
