import { renderHook, act } from '@testing-library/react-native';
import { useCoachActions } from '../useCoachActions';

const mockRun = jest.fn();
const mockCommit = jest.fn();

jest.mock('@/ai/agent/whatNext', () => ({
  whatShouldIDoNextWithActions: (...args: unknown[]) => mockRun(...args),
}));
jest.mock('@/ai/agent/actionQueue', () => ({
  commitActions: (...args: unknown[]) => mockCommit(...args),
}));

const fakeAction = { type: 'complete_task', payload: { taskId: 't1' } };

beforeEach(() => jest.clearAllMocks());

describe('useCoachActions', () => {
  it('starts idle with empty proposals', () => {
    const { result } = renderHook(() => useCoachActions('u1'));
    expect(result.current.status).toBe('idle');
    expect(result.current.proposals).toEqual([]);
    expect(result.current.answer).toBeNull();
  });

  it('run() transitions to done with answer and proposals', async () => {
    mockRun.mockResolvedValue({
      answer: 'Complete your workout.',
      proposedActions: [fakeAction],
    });
    const { result } = renderHook(() => useCoachActions('u1'));

    await act(async () => { await result.current.run(); });

    expect(result.current.status).toBe('done');
    expect(result.current.answer).toBe('Complete your workout.');
    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0]?.state).toBe('pending');
  });

  it('run() no-ops when userId is null', async () => {
    const { result } = renderHook(() => useCoachActions(null));
    await act(async () => { await result.current.run(); });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('run() no-ops while loading', async () => {
    let resolve!: (v: { answer: string; proposedActions: unknown[] }) => void;
    mockRun.mockReturnValueOnce(new Promise((r) => { resolve = r as typeof resolve; }));

    const { result } = renderHook(() => useCoachActions('u1'));
    act(() => { void result.current.run(); });
    expect(result.current.status).toBe('loading');

    await act(async () => { await result.current.run(); });
    expect(mockRun).toHaveBeenCalledTimes(1);

    await act(async () => { resolve({ answer: 'ok', proposedActions: [] }); });
  });

  it('run() transitions to error on rejection', async () => {
    mockRun.mockRejectedValue(new Error('agent timeout'));
    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('agent timeout');
  });

  it('dismiss() marks a proposal as dismissed without DB call', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });

    act(() => { result.current.dismiss(0); });

    expect(result.current.proposals[0]?.state).toBe('dismissed');
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('confirm() commits the proposal and sets state to done on success', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    mockCommit.mockResolvedValue([{ ok: true }]);

    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.confirm(0); });

    expect(mockCommit).toHaveBeenCalledWith([fakeAction]);
    expect(result.current.proposals[0]?.state).toBe('done');
  });

  it('confirm() sets state to failed when commitActions returns ok=false', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    mockCommit.mockResolvedValue([{ ok: false, error: 'Unknown action type' }]);

    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.confirm(0); });

    expect(result.current.proposals[0]?.state).toBe('failed');
    expect(result.current.proposals[0]?.error).toBe('Unknown action type');
  });

  it('confirm() sets state to failed when commitActions throws', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    mockCommit.mockRejectedValue(new Error('db write failed'));

    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.confirm(0); });

    expect(result.current.proposals[0]?.state).toBe('failed');
  });

  it('confirm() no-ops on a non-pending proposal (double-tap guard)', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    mockCommit.mockResolvedValue([{ ok: true }]);

    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });
    // First confirm
    await act(async () => { await result.current.confirm(0); });
    // Second confirm — should be ignored
    await act(async () => { await result.current.confirm(0); });

    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it('reset() clears everything back to idle', async () => {
    mockRun.mockResolvedValue({ answer: 'ok', proposedActions: [fakeAction] });
    const { result } = renderHook(() => useCoachActions('u1'));
    await act(async () => { await result.current.run(); });

    act(() => { result.current.reset(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBeNull();
    expect(result.current.proposals).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
