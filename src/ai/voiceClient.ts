import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true';

const MODEL = 'models/gemini-2.5-flash-preview-native-audio-dialog';

function buildWsUrl(token: string): string {
  const base = PROXY_URL.replace(/^http/, 'ws');
  return `${base}/gemini-live?token=${encodeURIComponent(token)}`;
}

export type VoiceEvent =
  | { type: 'open' }
  | { type: 'audio'; pcmBase64: string }
  | { type: 'text'; text: string }
  | { type: 'turnComplete' }
  | { type: 'error'; message: string }
  | { type: 'close' };

export interface VoiceSessionOptions {
  systemInstruction?: string;
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  onEvent: (event: VoiceEvent) => void;
}

export interface VoiceSession {
  sendAudioChunk: (pcm16Base64: string) => void;
  sendText: (text: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createVoiceSession(opts: VoiceSessionOptions): VoiceSession {
  if (USE_MOCK) return createMockSession(opts);

  let ws: WebSocket | null = null;
  let open = false;

  (async () => {
    const token = await getSupabaseAccessToken();
    if (!token) {
      opts.onEvent({ type: 'error', message: 'Sign in required for voice.' });
      return;
    }
    ws = new WebSocket(buildWsUrl(token));
    ws.onopen = () => {
      open = true;
      ws?.send(
        JSON.stringify({
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: opts.voice ?? 'Aoede' },
                },
              },
            },
            systemInstruction: opts.systemInstruction
              ? { parts: [{ text: opts.systemInstruction }] }
              : undefined,
          },
        }),
      );
      opts.onEvent({ type: 'open' });
    };
    ws.onmessage = async (ev) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
        const msg = JSON.parse(raw);
        const parts = msg.serverContent?.modelTurn?.parts ?? [];
        for (const p of parts) {
          if (p.inlineData?.mimeType?.startsWith('audio/')) {
            opts.onEvent({ type: 'audio', pcmBase64: p.inlineData.data });
          } else if (p.text) {
            opts.onEvent({ type: 'text', text: p.text });
          }
        }
        if (msg.serverContent?.turnComplete) opts.onEvent({ type: 'turnComplete' });
      } catch (err) {
        opts.onEvent({
          type: 'error',
          message: err instanceof Error ? err.message : 'parse error',
        });
      }
    };
    ws.onerror = () => opts.onEvent({ type: 'error', message: 'websocket error' });
    ws.onclose = () => {
      open = false;
      opts.onEvent({ type: 'close' });
    };
  })();

  return {
    sendAudioChunk: (pcm16Base64) => {
      if (!open || !ws) return;
      ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: pcm16Base64 }],
          },
        }),
      );
    },
    sendText: (text) => {
      if (!open || !ws) return;
      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          },
        }),
      );
    },
    close: () => ws?.close(),
    isOpen: () => open,
  };
}

function createMockSession(opts: VoiceSessionOptions): VoiceSession {
  setTimeout(() => opts.onEvent({ type: 'open' }), 50);
  return {
    sendAudioChunk: () => {},
    sendText: (text) => {
      setTimeout(() => {
        opts.onEvent({
          type: 'text',
          text: `[mock voice] I heard: "${text}". Today you have a workout at 7am and a learning block at 8pm.`,
        });
        opts.onEvent({ type: 'turnComplete' });
      }, 300);
    },
    close: () => {},
    isOpen: () => true,
  };
}
