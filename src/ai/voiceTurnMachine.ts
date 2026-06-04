/**
 * Pure decision core for the voice turn lifecycle — extracted from useVoice so
 * the timing-sensitive manual-VAD + turn-completion logic (the "turn actually
 * completes" / "play the model's reply" behaviour) can be unit-tested without a
 * live session, a mic, or React.
 *
 * It is a reducer: `reduceVoiceTurn(state, input) → { state, effects }`. The
 * hook owns all I/O — refs, React state, the VoiceSession, mic, and player — and
 * simply mirrors the returned `state`, then carries out the `effects` (UI state
 * updates + the manual-VAD markActivityStart/End signals). Nothing here touches
 * the outside world, so every branch is deterministic given (level, now,
 * isPlaying).
 */

/**
 * The lifecycle of a single voice exchange, surfaced to the UI:
 *  idle · connecting · listening · thinking · speaking · error
 */
export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

/** The decision-relevant state (mirrors the hook's refs). */
export interface VoiceTurnState {
  status: VoiceStatus;
  /** Mic is currently picking up active speech. */
  userSpeaking: boolean;
  /** The user has spoken at least once this turn (gates the silence→thinking edge). */
  spokeThisTurn: boolean;
  /** Timestamp (ms) of the last above-threshold mic level. */
  lastVoiceAt: number;
  /** Inside a manual-VAD utterance window (between markActivityStart/End). */
  activityActive: boolean;
  /** The model signalled turn end; we're waiting for audio playback to drain. */
  turnComplete: boolean;
}

export type VoiceTurnInput =
  /** A mic RMS-level tick. */
  | { kind: 'level'; level: number; now: number }
  /** Model output (audio or text) started arriving. */
  | { kind: 'modelOutput' }
  /** Model signalled the turn is complete; `isPlaying` = is audio still playing. */
  | { kind: 'turnComplete'; isPlaying: boolean }
  /** The audio player finished draining its queue. */
  | { kind: 'drain' }
  /** Barge-in: the model's turn was interrupted. */
  | { kind: 'interrupted' };

/**
 * Side-effects for the hook to carry out. State changes are already reflected in
 * the returned `state`; these are the things the pure core can't do itself: push
 * the change to React UI state and send the manual-VAD window signals.
 */
export type VoiceTurnEffect =
  | { type: 'setStatus'; status: VoiceStatus }
  | { type: 'setUserSpeaking'; value: boolean }
  | { type: 'markActivityStart' }
  | { type: 'markActivityEnd' };

/** Client-side voice-activity heuristic (see reduceVoiceTurn 'level'). */
export const SPEECH_THRESHOLD = 0.08;
export const SILENCE_MS = 900;

export function initialVoiceTurnState(): VoiceTurnState {
  return {
    status: 'idle',
    userSpeaking: false,
    spokeThisTurn: false,
    lastVoiceAt: 0,
    activityActive: false,
    turnComplete: false,
  };
}

export interface VoiceTurnResult {
  state: VoiceTurnState;
  effects: VoiceTurnEffect[];
}

export function reduceVoiceTurn(state: VoiceTurnState, input: VoiceTurnInput): VoiceTurnResult {
  switch (input.kind) {
    case 'level':
      return reduceLevel(state, input.level, input.now);

    case 'modelOutput': {
      // Output started → model is speaking; reset the per-turn spoke flag.
      const next: VoiceTurnState = { ...state, spokeThisTurn: false };
      if (state.status === 'speaking') return { state: next, effects: [] };
      next.status = 'speaking';
      return { state: next, effects: [{ type: 'setStatus', status: 'speaking' }] };
    }

    case 'turnComplete': {
      // Model finished. If no audio is playing (text-only / mock), go straight
      // back to listening; otherwise keep turnComplete set and wait for 'drain'.
      if (input.isPlaying) {
        return { state: { ...state, turnComplete: true }, effects: [] };
      }
      return {
        state: { ...state, turnComplete: false, status: 'listening' },
        effects: [{ type: 'setStatus', status: 'listening' }],
      };
    }

    case 'drain': {
      // Playback finished; only resume listening if a turn was pending.
      if (!state.turnComplete) return { state, effects: [] };
      return {
        state: { ...state, turnComplete: false, status: 'listening' },
        effects: [{ type: 'setStatus', status: 'listening' }],
      };
    }

    case 'interrupted':
      // Barge-in: drop the pending turn and listen again.
      return {
        state: { ...state, turnComplete: false, status: 'listening' },
        effects: [{ type: 'setStatus', status: 'listening' }],
      };
  }
}

function reduceLevel(state: VoiceTurnState, level: number, now: number): VoiceTurnResult {
  // Mic ticks are ignored while the model is speaking (so its own playback isn't
  // mistaken for user speech).
  if (state.status === 'speaking') return { state, effects: [] };

  const next: VoiceTurnState = { ...state };
  const effects: VoiceTurnEffect[] = [];

  if (level > SPEECH_THRESHOLD) {
    if (!next.userSpeaking) {
      next.userSpeaking = true;
      effects.push({ type: 'setUserSpeaking', value: true });
    }
    // Speech onset → open a manual-VAD activity window (stream audio + tell the
    // model the user started talking).
    if (!next.activityActive) {
      next.activityActive = true;
      effects.push({ type: 'markActivityStart' });
    }
    next.spokeThisTurn = true;
    next.lastVoiceAt = now;
    if (next.status === 'thinking') {
      next.status = 'listening';
      effects.push({ type: 'setStatus', status: 'listening' });
    }
  } else {
    if (next.userSpeaking) {
      next.userSpeaking = false;
      effects.push({ type: 'setUserSpeaking', value: false });
    }
    if (next.spokeThisTurn && next.status === 'listening' && now - next.lastVoiceAt > SILENCE_MS) {
      next.status = 'thinking';
      effects.push({ type: 'setStatus', status: 'thinking' });
      // Speech ended → close the activity window. This is the signal that makes
      // the model actually start generating (without it the turn never completes
      // and the UI hangs on "thinking").
      if (next.activityActive) {
        next.activityActive = false;
        effects.push({ type: 'markActivityEnd' });
      }
    }
  }

  return { state: next, effects };
}
