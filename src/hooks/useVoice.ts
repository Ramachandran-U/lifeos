import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceSession,
  VoiceSession,
  VoiceSessionOptions,
} from '@/ai/voiceClient';
import { startMicCapture, type MicHandle } from '@/ai/micCapture';
import { createPcmPlayer, type PcmPlayerHandle } from '@/ai/pcmPlayer';
import {
  reduceVoiceTurn,
  initialVoiceTurnState,
  type VoiceStatus,
  type VoiceTurnInput,
  type VoiceTurnState,
} from '@/ai/voiceTurnMachine';

// The turn lifecycle, manual-VAD heuristic, and turn-completion decisions live in
// the pure `voiceTurnMachine` so they're unit-testable without a session/mic/React.
// This hook owns the I/O: the VoiceSession, mic, player, refs, and React state —
// it mirrors the machine's returned state and carries out its effects.
export type { VoiceStatus };

export interface UseVoiceResult {
  status: VoiceStatus;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  /** True while the mic is picking up active speech from the user. */
  userSpeaking: boolean;
  /** The assistant's transcript (output). */
  transcript: string;
  /** What the user said (input transcript). */
  userTranscript: string;
  error: string | null;
  audioLevel: number;
  connect: () => void;
  disconnect: () => void;
  sendText: (text: string) => void;
  sendAudioChunk: (pcm16Base64: string) => void;
  /** Unlock/resume audio output — call from a user-gesture handler. */
  resumeAudio: () => void;
}

export function useVoice(
  options: Omit<VoiceSessionOptions, 'onEvent'> = {},
): UseVoiceResult {
  const sessionRef = useRef<VoiceSession | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const playerRef = useRef<PcmPlayerHandle | null>(null);

  const [status, setStatusState] = useState<VoiceStatus>('idle');
  const [isConnected, setConnected] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // The decision state mirrored from the pure machine; read inside the
  // event/level callbacks (avoids stale closures, the role the individual refs
  // used to play).
  const machineRef = useRef<VoiceTurnState>(initialVoiceTurnState());

  // Direct status set (transitions not driven by the machine: connecting/open/
  // sendText/error/close). Keeps the mirrored state and the UI in lockstep.
  const setStatus = useCallback((s: VoiceStatus) => {
    machineRef.current = { ...machineRef.current, status: s };
    setStatusState(s);
  }, []);

  // Run the pure reducer, mirror its next state, then carry out its effects.
  const dispatch = useCallback((input: VoiceTurnInput) => {
    const { state, effects } = reduceVoiceTurn(machineRef.current, input);
    machineRef.current = state;
    for (const e of effects) {
      switch (e.type) {
        case 'setStatus':
          setStatusState(e.status);
          break;
        case 'setUserSpeaking':
          setUserSpeaking(e.value);
          break;
        case 'markActivityStart':
          sessionRef.current?.markActivityStart();
          break;
        case 'markActivityEnd':
          sessionRef.current?.markActivityEnd();
          break;
      }
    }
  }, []);

  // Mic level tick — drives the user-speaking indicator and the listening↔thinking
  // transitions (ignored while the model is speaking; see the machine).
  const handleLevel = useCallback(
    (level: number) => {
      setAudioLevel(level);
      dispatch({ kind: 'level', level, now: Date.now() });
    },
    [dispatch],
  );

  // Model output (audio or text) started arriving → the model is speaking.
  const onModelOutput = useCallback(() => {
    dispatch({ kind: 'modelOutput' });
  }, [dispatch]);

  const connect = useCallback(() => {
    if (sessionRef.current?.isOpen()) return;
    setError(null);
    setTranscript('');
    setUserTranscript('');
    machineRef.current = {
      ...machineRef.current,
      spokeThisTurn: false,
      turnComplete: false,
      activityActive: false,
    };
    setStatus('connecting');

    // Create the player up front (before the async session opens) so a user
    // gesture — e.g. the send button — can resume/unlock audio output before
    // the first chunk arrives. On web the AudioContext stays suspended until
    // resume() runs inside a gesture; this is what makes playback audible.
    playerRef.current = createPcmPlayer({
      onDrain: () => dispatch({ kind: 'drain' }),
      onError: (msg: string) => console.warn('[voice] playback:', msg),
    });

    const timeout = setTimeout(() => {
      if (!sessionRef.current?.isOpen()) {
        setError('Connection timed out. Please check your network and try again.');
        setStatus('error');
        sessionRef.current?.close();
        sessionRef.current = null;
      }
    }, 10000);

    sessionRef.current = createVoiceSession({
      ...options,
      onEvent: (event) => {
        switch (event.type) {
          case 'open':
            clearTimeout(timeout);
            setConnected(true);
            setStatus('listening');
            // Best-effort unlock now that the session is live (the real unlock
            // happens on the next user gesture via resumeAudio()).
            playerRef.current?.resume();
            // Mic capture is non-fatal — in CI (headless) getUserMedia fails,
            // but voice still works via text input.
            micRef.current = startMicCapture({
              // Only stream audio inside an active utterance window (manual VAD).
              // This brackets each turn for the model and prevents the model's
              // own playback from being captured and echoed back as input.
              onChunk: (pcm16Base64: string) => {
                if (machineRef.current.activityActive) sessionRef.current?.sendAudioChunk(pcm16Base64);
              },
              onLevel: handleLevel,
              onError: (msg: string) => console.warn('[voice] mic:', msg),
            });
            break;
          case 'audio':
            onModelOutput();
            playerRef.current?.enqueue(event.pcmBase64);
            break;
          case 'text':
            onModelOutput();
            setTranscript((prev) => prev + event.text);
            break;
          case 'inputTranscript':
            setUserTranscript((prev) => prev + event.text);
            break;
          case 'interrupted':
            // Barge-in: stop the model's audio and return to listening.
            playerRef.current?.stop();
            dispatch({ kind: 'interrupted' });
            break;
          case 'turnComplete':
            // Mark the turn pending BEFORE endTurn() so a player that drains
            // synchronously (empty queue) still sees turnComplete and resumes
            // listening — matching the original ref-ordering. Native buffers the
            // turn and starts playback in endTurn(); web has already streamed, so
            // it's a no-op there. The machine then decides: no audio playing →
            // straight to listening; else wait for the player to drain ('drain').
            machineRef.current = { ...machineRef.current, turnComplete: true };
            playerRef.current?.endTurn();
            dispatch({ kind: 'turnComplete', isPlaying: playerRef.current?.isPlaying() ?? false });
            break;
          case 'error':
            setError(event.message);
            setStatus('error');
            break;
          case 'close':
            micRef.current?.stop();
            micRef.current = null;
            playerRef.current?.dispose();
            playerRef.current = null;
            setConnected(false);
            machineRef.current = { ...machineRef.current, userSpeaking: false, activityActive: false };
            setUserSpeaking(false);
            setAudioLevel(0);
            if (machineRef.current.status !== 'error') setStatus('idle');
            break;
        }
      },
    });
  }, [options, dispatch, handleLevel, onModelOutput, setStatus]);

  const disconnect = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    machineRef.current = { ...machineRef.current, userSpeaking: false, activityActive: false };
    setUserSpeaking(false);
    setAudioLevel(0);
    setStatus('idle');
  }, [setStatus]);

  const sendText = useCallback(
    (text: string) => {
      setUserTranscript((prev) => (prev ? `${prev}\n${text}` : text));
      // Typed messages get no mic-driven "thinking" transition, so set it here
      // for immediate feedback that the message is being processed.
      setStatus('thinking');
      sessionRef.current?.sendText(text);
    },
    [setStatus],
  );

  const sendAudioChunk = useCallback((pcm16Base64: string) => {
    sessionRef.current?.sendAudioChunk(pcm16Base64);
  }, []);

  const resumeAudio = useCallback(() => {
    playerRef.current?.resume();
  }, []);

  useEffect(() => {
    return () => {
      micRef.current?.stop();
      playerRef.current?.dispose();
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  return {
    status,
    isConnected,
    isSpeaking: status === 'speaking',
    isListening: status === 'listening',
    isThinking: status === 'thinking',
    userSpeaking,
    transcript,
    userTranscript,
    error,
    audioLevel,
    connect,
    disconnect,
    sendText,
    sendAudioChunk,
    resumeAudio,
  };
}
