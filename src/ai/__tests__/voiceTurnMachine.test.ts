/**
 * Pure voice-turn machine — the manual-VAD + turn-completion logic extracted from
 * useVoice. These are the timing-sensitive transitions ("turn actually
 * completes", "play the model's reply") that previously had zero regression
 * guard. Deterministic given (level, now, isPlaying) — no session/mic/React.
 */
import {
  reduceVoiceTurn,
  initialVoiceTurnState,
  SPEECH_THRESHOLD,
  SILENCE_MS,
  type VoiceTurnState,
  type VoiceTurnEffect,
} from '../voiceTurnMachine';

const base = (over: Partial<VoiceTurnState> = {}): VoiceTurnState => ({
  ...initialVoiceTurnState(),
  status: 'listening',
  ...over,
});

const LOUD = SPEECH_THRESHOLD + 0.05;
const QUIET = SPEECH_THRESHOLD - 0.05;

const types = (effects: VoiceTurnEffect[]) => effects.map((e) => e.type);

describe('initialVoiceTurnState', () => {
  it('starts idle, not speaking, nothing pending', () => {
    expect(initialVoiceTurnState()).toEqual({
      status: 'idle',
      userSpeaking: false,
      spokeThisTurn: false,
      lastVoiceAt: 0,
      activityActive: false,
      turnComplete: false,
    });
  });
});

describe('reduceVoiceTurn — level (manual VAD)', () => {
  it('ignores mic level entirely while the model is speaking', () => {
    const s = base({ status: 'speaking', userSpeaking: true });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: LOUD, now: 1000 });
    expect(state).toEqual(s); // unchanged
    expect(effects).toEqual([]);
  });

  it('speech onset: opens activity window + flags user speaking', () => {
    const { state, effects } = reduceVoiceTurn(base(), { kind: 'level', level: LOUD, now: 5000 });
    expect(state.userSpeaking).toBe(true);
    expect(state.activityActive).toBe(true);
    expect(state.spokeThisTurn).toBe(true);
    expect(state.lastVoiceAt).toBe(5000);
    expect(state.status).toBe('listening');
    expect(types(effects)).toEqual(['setUserSpeaking', 'markActivityStart']);
    expect(effects).toContainEqual({ type: 'setUserSpeaking', value: true });
  });

  it('continued speech: no duplicate setUserSpeaking / markActivityStart, just advances lastVoiceAt', () => {
    const s = base({ userSpeaking: true, activityActive: true, spokeThisTurn: true, lastVoiceAt: 1000 });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: LOUD, now: 1200 });
    expect(state.lastVoiceAt).toBe(1200);
    expect(effects).toEqual([]); // already speaking + active
  });

  it('speech onset while thinking → back to listening', () => {
    const s = base({ status: 'thinking' });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: LOUD, now: 2000 });
    expect(state.status).toBe('listening');
    expect(types(effects)).toEqual(['setUserSpeaking', 'markActivityStart', 'setStatus']);
    expect(effects).toContainEqual({ type: 'setStatus', status: 'listening' });
  });

  it('the speech threshold is exclusive: level === SPEECH_THRESHOLD counts as quiet', () => {
    const { state, effects } = reduceVoiceTurn(base(), { kind: 'level', level: SPEECH_THRESHOLD, now: 1 });
    expect(state.userSpeaking).toBe(false);
    expect(state.activityActive).toBe(false);
    expect(effects).toEqual([]); // wasn't speaking, no transition
  });

  it('brief quiet (< SILENCE_MS) after speech: drops userSpeaking but does NOT end the turn', () => {
    const s = base({ userSpeaking: true, activityActive: true, spokeThisTurn: true, lastVoiceAt: 1000 });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: QUIET, now: 1000 + SILENCE_MS }); // exactly SILENCE_MS, not >
    expect(state.userSpeaking).toBe(false);
    expect(state.status).toBe('listening'); // not yet thinking
    expect(state.activityActive).toBe(true); // window still open
    expect(types(effects)).toEqual(['setUserSpeaking']);
  });

  it('sustained silence (> SILENCE_MS) after speech: ends the turn → thinking + closes the window', () => {
    const s = base({ userSpeaking: true, activityActive: true, spokeThisTurn: true, lastVoiceAt: 1000 });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: QUIET, now: 1000 + SILENCE_MS + 1 });
    expect(state.userSpeaking).toBe(false);
    expect(state.status).toBe('thinking');
    expect(state.activityActive).toBe(false);
    expect(types(effects)).toEqual(['setUserSpeaking', 'setStatus', 'markActivityEnd']);
    expect(effects).toContainEqual({ type: 'setStatus', status: 'thinking' });
  });

  it('silence with no prior speech this turn: no thinking transition', () => {
    const s = base({ spokeThisTurn: false });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: QUIET, now: 999_999 });
    expect(state.status).toBe('listening');
    expect(effects).toEqual([]);
  });

  it('silence while not in listening (already thinking): no re-trigger', () => {
    const s = base({ status: 'thinking', spokeThisTurn: true, lastVoiceAt: 0 });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'level', level: QUIET, now: 999_999 });
    expect(state.status).toBe('thinking');
    expect(effects).toEqual([]);
  });
});

describe('reduceVoiceTurn — modelOutput', () => {
  it('transitions to speaking and clears spokeThisTurn', () => {
    const s = base({ status: 'thinking', spokeThisTurn: true });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'modelOutput' });
    expect(state.status).toBe('speaking');
    expect(state.spokeThisTurn).toBe(false);
    expect(effects).toEqual([{ type: 'setStatus', status: 'speaking' }]);
  });

  it('already speaking: no setStatus effect, still clears spokeThisTurn', () => {
    const s = base({ status: 'speaking', spokeThisTurn: true });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'modelOutput' });
    expect(state.status).toBe('speaking');
    expect(state.spokeThisTurn).toBe(false);
    expect(effects).toEqual([]);
  });
});

describe('reduceVoiceTurn — turnComplete', () => {
  it('audio still playing: marks turnComplete, waits (no status change)', () => {
    const s = base({ status: 'speaking' });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'turnComplete', isPlaying: true });
    expect(state.turnComplete).toBe(true);
    expect(state.status).toBe('speaking');
    expect(effects).toEqual([]);
  });

  it('no audio playing (text-only / mock): straight back to listening', () => {
    const s = base({ status: 'speaking' });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'turnComplete', isPlaying: false });
    expect(state.turnComplete).toBe(false);
    expect(state.status).toBe('listening');
    expect(effects).toEqual([{ type: 'setStatus', status: 'listening' }]);
  });
});

describe('reduceVoiceTurn — drain', () => {
  it('with a pending turn: resumes listening', () => {
    const s = base({ status: 'speaking', turnComplete: true });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'drain' });
    expect(state.turnComplete).toBe(false);
    expect(state.status).toBe('listening');
    expect(effects).toEqual([{ type: 'setStatus', status: 'listening' }]);
  });

  it('with no pending turn: no-op (mid-utterance playback drain)', () => {
    const s = base({ status: 'speaking', turnComplete: false });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'drain' });
    expect(state).toEqual(s);
    expect(effects).toEqual([]);
  });
});

describe('reduceVoiceTurn — interrupted', () => {
  it('barge-in: drops the pending turn and returns to listening', () => {
    const s = base({ status: 'speaking', turnComplete: true });
    const { state, effects } = reduceVoiceTurn(s, { kind: 'interrupted' });
    expect(state.turnComplete).toBe(false);
    expect(state.status).toBe('listening');
    expect(effects).toEqual([{ type: 'setStatus', status: 'listening' }]);
  });
});

describe('reduceVoiceTurn — purity', () => {
  it('never mutates the input state', () => {
    const s = base({ userSpeaking: false, spokeThisTurn: false });
    const snapshot = { ...s };
    reduceVoiceTurn(s, { kind: 'level', level: LOUD, now: 123 });
    expect(s).toEqual(snapshot);
  });
});

describe('full turn (audio) composes end-to-end', () => {
  it('listen → speak → silence → thinking → model speaks → turn complete → drain → listen', () => {
    let s = base({ status: 'listening' });
    const apply = (input: Parameters<typeof reduceVoiceTurn>[1]) => {
      s = reduceVoiceTurn(s, input).state;
    };

    apply({ kind: 'level', level: LOUD, now: 1000 }); // speech onset
    expect(s.activityActive).toBe(true);
    expect(s.spokeThisTurn).toBe(true);

    apply({ kind: 'level', level: QUIET, now: 1000 + SILENCE_MS + 1 }); // silence → end of turn
    expect(s.status).toBe('thinking');
    expect(s.activityActive).toBe(false);

    apply({ kind: 'modelOutput' }); // model replies (audio)
    expect(s.status).toBe('speaking');

    apply({ kind: 'turnComplete', isPlaying: true }); // audio still draining
    expect(s.status).toBe('speaking');
    expect(s.turnComplete).toBe(true);

    apply({ kind: 'drain' }); // playback finished
    expect(s.status).toBe('listening');
    expect(s.turnComplete).toBe(false);
  });

  it('text-only turn returns to listening without waiting for a drain', () => {
    let s = base({ status: 'thinking' });
    s = reduceVoiceTurn(s, { kind: 'modelOutput' }).state; // speaking
    s = reduceVoiceTurn(s, { kind: 'turnComplete', isPlaying: false }).state;
    expect(s.status).toBe('listening');
    expect(s.turnComplete).toBe(false);
  });
});
