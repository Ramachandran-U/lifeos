import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceSession, type VoiceSession } from '@/ai/voiceClient';
import { createPcmPlayer, type PcmPlayerHandle } from '@/ai/pcmPlayer';
import type { VoicePersona } from '@/ai/voicePersonas';

/**
 * Tap-to-hear preview for the voice persona picker.
 *
 * Reuses the live voice path (`createVoiceSession`) so the preview is the EXACT
 * voice + personality the companion will use — no separate sample assets to keep
 * in sync. It opens a short-lived, mic-less session, asks the model to introduce
 * itself in one sentence, plays the streamed audio, and tears down on turn end.
 *
 * Requires sign-in + network (same as the companion); errors surface via `error`.
 * A watchdog guarantees the "playing" state always clears even if the upstream
 * stalls. Only one preview plays at a time — starting another (or re-tapping the
 * same one) stops the current.
 */

// Cap a preview so a stalled upstream can't leave the row spinning forever.
const PREVIEW_TIMEOUT_MS = 9000;

function previewInstruction(p: VoicePersona): string {
  return (
    `You are previewing your voice as "${p.name}", the user's LifeOS voice companion. ` +
    `${p.personaPrompt} ` +
    `Say ONE short, friendly sentence (under 12 words) introducing yourself. ` +
    `Do not ask a question and do not use any tools.`
  );
}

export interface UseVoicePreviewResult {
  /** Persona id currently playing (or connecting), else null. */
  previewingId: string | null;
  error: string | null;
  /** Start previewing a persona; re-tapping the active one stops it. */
  preview: (persona: VoicePersona) => void;
  stop: () => void;
}

export function useVoicePreview(): UseVoicePreviewResult {
  const sessionRef = useRef<VoiceSession | null>(null);
  const playerRef = useRef<PcmPlayerHandle | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    sessionRef.current?.close();
    sessionRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    setPreviewingId(null);
  }, []);

  const preview = useCallback(
    (persona: VoicePersona) => {
      // Re-tapping the active persona toggles it off.
      const wasActive = previewingId === persona.id;
      stop();
      if (wasActive) return;

      setError(null);
      setPreviewingId(persona.id);

      const player = createPcmPlayer({
        onDrain: () => stop(), // finished speaking → clear the playing state
        onError: (msg: string) => console.warn('[voice-preview] playback:', msg),
      });
      playerRef.current = player;
      player.resume(); // the row tap is a user gesture — unlock web audio output

      const session = createVoiceSession({
        voice: persona.voiceName,
        systemInstruction: previewInstruction(persona),
        onEvent: (e) => {
          switch (e.type) {
            case 'open':
              // Mic-less: drive a single turn with text; the model replies in audio.
              session.sendText('Introduce your voice now.');
              break;
            case 'audio':
              playerRef.current?.enqueue(e.pcmBase64);
              break;
            case 'turnComplete':
              playerRef.current?.endTurn(); // native flushes; web already streamed
              break;
            case 'error':
              setError(e.message);
              stop();
              break;
            case 'close':
              // Normal teardown is owned by stop()/onDrain; nothing to do here.
              break;
          }
        },
      });
      sessionRef.current = session;

      watchdogRef.current = setTimeout(() => {
        if (sessionRef.current === session) stop();
      }, PREVIEW_TIMEOUT_MS);
    },
    [previewingId, stop],
  );

  // Tear down on unmount (navigating away from Settings mid-preview).
  useEffect(() => () => stop(), [stop]);

  return { previewingId, error, preview, stop };
}
