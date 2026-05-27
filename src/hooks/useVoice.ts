import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceSession,
  VoiceSession,
  VoiceSessionOptions,
} from '@/ai/voiceClient';
import { startMicCapture, type MicHandle } from '@/ai/micCapture';

export interface UseVoiceResult {
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  /** Real-time mic amplitude 0-1, updated ~4× per second. */
  audioLevel: number;
  connect: () => void;
  disconnect: () => void;
  sendText: (text: string) => void;
  sendAudioChunk: (pcm16Base64: string) => void;
}

export function useVoice(
  options: Omit<VoiceSessionOptions, 'onEvent'> = {},
): UseVoiceResult {
  const sessionRef = useRef<VoiceSession | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const [isConnected, setConnected] = useState(false);
  const [isSpeaking, setSpeaking] = useState(false);
  const [isListening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const connect = useCallback(async () => {
    if (sessionRef.current?.isOpen()) return;
    setError(null);
    setTranscript('');
    audioQueueRef.current = [];

    // Get mic permission BEFORE opening the WebSocket so the browser's
    // permission prompt doesn't block the live session (on mobile, the prompt
    // can take seconds and the WS may time out waiting for audio).
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((t) => t.stop());
      } catch {
        setError('Microphone access denied. Please allow mic access and try again.');
        return;
      }
    }

    // Connection timeout — if the WS doesn't open within 10s, surface an error
    // instead of hanging on "CONNECTING" forever.
    const timeout = setTimeout(() => {
      if (!sessionRef.current?.isOpen()) {
        setError('Connection timed out. Please check your network and try again.');
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
            micRef.current = startMicCapture({
              onChunk: (pcm16Base64) => sessionRef.current?.sendAudioChunk(pcm16Base64),
              onLevel: setAudioLevel,
              onError: (msg) => setError(msg),
            });
            setListening(true);
            break;
          case 'audio':
            audioQueueRef.current.push(event.pcmBase64);
            setSpeaking(true);
            setListening(false);
            break;
          case 'text':
            setTranscript((prev) => prev + event.text);
            break;
          case 'turnComplete':
            setSpeaking(false);
            // Resume listening for the next turn.
            setListening(true);
            break;
          case 'error':
            setError(event.message);
            break;
          case 'close':
            micRef.current?.stop();
            micRef.current = null;
            setConnected(false);
            setSpeaking(false);
            setListening(false);
            setAudioLevel(0);
            break;
        }
      },
    });
  }, [options]);

  const disconnect = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setSpeaking(false);
    setListening(false);
    setAudioLevel(0);
  }, []);

  const sendText = useCallback((text: string) => {
    sessionRef.current?.sendText(text);
  }, []);

  const sendAudioChunk = useCallback((pcm16Base64: string) => {
    sessionRef.current?.sendAudioChunk(pcm16Base64);
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  return {
    isConnected,
    isSpeaking,
    isListening,
    transcript,
    error,
    audioLevel,
    connect,
    disconnect,
    sendText,
    sendAudioChunk,
  };
}
