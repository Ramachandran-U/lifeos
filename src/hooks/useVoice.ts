import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceSession,
  VoiceSession,
  VoiceSessionOptions,
} from '@/ai/voiceClient';

export interface UseVoiceResult {
  isConnected: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendText: (text: string) => void;
  sendAudioChunk: (pcm16Base64: string) => void;
}

export function useVoice(
  options: Omit<VoiceSessionOptions, 'onEvent'> = {},
): UseVoiceResult {
  const sessionRef = useRef<VoiceSession | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const [isConnected, setConnected] = useState(false);
  const [isSpeaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (sessionRef.current?.isOpen()) return;
    setError(null);
    setTranscript('');
    audioQueueRef.current = [];

    sessionRef.current = createVoiceSession({
      ...options,
      onEvent: (event) => {
        switch (event.type) {
          case 'open':
            setConnected(true);
            break;
          case 'audio':
            audioQueueRef.current.push(event.pcmBase64);
            setSpeaking(true);
            break;
          case 'text':
            setTranscript((prev) => prev + event.text);
            break;
          case 'turnComplete':
            setSpeaking(false);
            break;
          case 'error':
            setError(event.message);
            break;
          case 'close':
            setConnected(false);
            setSpeaking(false);
            break;
        }
      },
    });
  }, [options]);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setSpeaking(false);
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
    transcript,
    error,
    connect,
    disconnect,
    sendText,
    sendAudioChunk,
  };
}
