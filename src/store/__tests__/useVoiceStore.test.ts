import { useVoiceStore } from '@/store/useVoiceStore';
import type { ProposedAction } from '@/ai/agent/actionQueue';

const goalAction: ProposedAction = {
  kind: 'createGoalFromVision',
  summary: 'Create a goal',
  payload: { visionStatement: 'run a marathon' },
};

beforeEach(() => {
  useVoiceStore.setState({ open: false, minimized: false, pendingActions: [] });
});

describe('useVoiceStore', () => {
  it('openVoice opens expanded and clears stale proposals', () => {
    useVoiceStore.setState({ minimized: true, pendingActions: [goalAction] });
    useVoiceStore.getState().openVoice();
    const s = useVoiceStore.getState();
    expect(s.open).toBe(true);
    expect(s.minimized).toBe(false);
    expect(s.pendingActions).toEqual([]);
  });

  it('minimize / expand toggle without closing', () => {
    useVoiceStore.getState().openVoice();
    useVoiceStore.getState().minimize();
    expect(useVoiceStore.getState().minimized).toBe(true);
    expect(useVoiceStore.getState().open).toBe(true);
    useVoiceStore.getState().expand();
    expect(useVoiceStore.getState().minimized).toBe(false);
  });

  it('close resets everything', () => {
    useVoiceStore.setState({ open: true, minimized: true, pendingActions: [goalAction] });
    useVoiceStore.getState().close();
    expect(useVoiceStore.getState()).toMatchObject({ open: false, minimized: false, pendingActions: [] });
  });

  it('add / remove / clear pending actions', () => {
    const { addPendingAction, removePendingAction, clearPending } = useVoiceStore.getState();
    addPendingAction(goalAction);
    addPendingAction({ ...goalAction, summary: 'second' });
    expect(useVoiceStore.getState().pendingActions).toHaveLength(2);
    removePendingAction(0);
    expect(useVoiceStore.getState().pendingActions.map((a) => a.summary)).toEqual(['second']);
    clearPending();
    expect(useVoiceStore.getState().pendingActions).toEqual([]);
  });
});
