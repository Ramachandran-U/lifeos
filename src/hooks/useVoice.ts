import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceSession,
  VoiceSession,
  VoiceSessionOptions,
} from '@/ai/voiceClient';
import { startMicCapture, type MicHandle } from '@/ai/micCapture';
import { createPcmPlayer, type PcmPlayerHandle } from '@/ai/pcmPlayer';

/**
 * The lifecycle of a single voice exchange, surfaced to the UI so the user
 * always knows what's happening:
 *  - idle:       not connected
 *  - connecting: opening the session
 *  - listening:  mic is live, waiting for / hearing the user
 *  - thinking:   user finished, model is generating its reply
 *  - speaking:   model audio is playing back
 *  - error:      something failed
 */
export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

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

// Client-side voice-activity heuristic. The mic emits an RMS level continuously;
// once the user has spoken and then falls quiet for SILENCE_MS, we assume their
// turn ended and the model is now processing → show "thinking".
const SPEECH_THRESHOLD = 0.08;
const SILENCE_MS = 900;

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

  // Refs mirror state for use inside event/level callbacks (avoid stale closures).
  const statusRef = useRef<VoiceStatus>('idle');
  const spokeThisTurnRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const userSpeakingRef = useRef(false);
  const turnCompleteRef = useRef(false);
  // Manual VAD: whether we're inside a user utterance (between activityStart
  // and activityEnd). Audio chunks are only streamed while this is true, which
  // also keeps the model's own playback from echoing back as user speech.
  const activityActiveRef = useRef(false);

  const setStatus = useCallback((s: VoiceStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // Model output (audio or text) has started arriving → the model is speaking.
  const onModelOutput = useCallback(() => {
    spokeThisTurnRef.current = false;
    if (statusRef.current !== 'speaking') setStatus('speaking');
  }, [setStatus]);

  // Mic level tick — drives the user-speaking indicator and the listening→thinking
  // transition. Ignored while the model is speaking.
  const handleLevel = useCallback(
    (level: number) => {
      setAudioLevel(level);
      if (statusRef.current === 'speaking') return;

      const now = Date.now();
      if (level > SPEECH_THRESHOLD) {
        if (!userSpeakingRef.current) {
          userSpeakingRef.current = true;
          setUserSpeaking(true);
        }
        // Speech onset → open a manual-VAD activity window so audio is streamed
        // and the model knows the user has started talking.
        if (!activityActiveRef.current) {
          activityActiveRef.current = true;
          sessionRef.current?.markActivityStart();
        }
        spokeThisTurnRef.current = true;
        lastVoiceAtRef.current = now;
        if (statusRef.current === 'thinking') setStatus('listening');
      } else {
        if (userSpeakingRef.current) {
          userSpeakingRef.current = false;
          setUserSpeaking(false);
        }
        if (
          spokeThisTurnRef.current &&
          statusRef.current === 'listening' &&
          now - lastVoiceAtRef.current > SILENCE_MS
        ) {
          setStatus('thinking');
          // Speech ended → close the activity window. This is the signal that
          // makes the model actually start generating (without it, the turn
          // never completes and the UI hangs on "thinking").
          if (activityActiveRef.current) {
            activityActiveRef.current = false;
            sessionRef.current?.markActivityEnd();
          }
        }
      }
    },
    [setStatus],
  );

  const connect = useCallback(() => {
    if (sessionRef.current?.isOpen()) return;
    setError(null);
    setTranscript('');
    setUserTranscript('');
    spokeThisTurnRef.current = false;
    turnCompleteRef.current = false;
    activityActiveRef.current = false;
    setStatus('connecting');

    // Create the player up front (before the async session opens) so a user
    // gesture — e.g. the send button — can resume/unlock audio output before
    // the first chunk arrives. On web the AudioContext stays suspended until
    // resume() runs inside a gesture; this is what makes playback audible.
    playerRef.current = createPcmPlayer({
      onDrain: () => {
        if (turnCompleteRef.current) {
          turnCompleteRef.current = false;
          setStatus('listening');
        }
      },
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
                if (activityActiveRef.current) sessionRef.current?.sendAudioChunk(pcm16Base64);
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
            turnCompleteRef.current = false;
            setStatus('listening');
            break;
          case 'turnComplete':
            turnCompleteRef.current = true;
            // Native buffers the turn and starts playback here; web has already
            // been streaming, so this is a no-op there.
            playerRef.current?.endTurn();
            // If no audio is playing (e.g. text-only / mock), go straight back
            // to listening; otherwise wait for the player to drain.
            if (!playerRef.current?.isPlaying()) {
              turnCompleteRef.current = false;
              setStatus('listening');
            }
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
            setUserSpeaking(false);
            userSpeakingRef.current = false;
            activityActiveRef.current = false;
            setAudioLevel(0);
            if (statusRef.current !== 'error') setStatus('idle');
            break;
        }
      },
    });
  }, [options, handleLevel, onModelOutput, setStatus]);

  const disconnect = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setUserSpeaking(false);
    userSpeakingRef.current = false;
    activityActiveRef.current = false;
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
