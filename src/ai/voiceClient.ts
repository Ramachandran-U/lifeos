import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true';

const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

function buildWsUrl(): string {
  const base = PROXY_URL.replace(/^http/, 'ws');
  return `${base}/gemini-live`;
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
    let token: string | null = null;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token ?? null;
    } catch {
      token = await getSupabaseAccessToken();
    }
    if (!token) {
      opts.onEvent({ type: 'error', message: 'Sign in required for voice.' });
      return;
    }
    ws = new WebSocket(buildWsUrl());
    ws.onopen = () => {
      ws?.send(JSON.stringify({ auth: token }));
    };

    let authed = false;
    ws.onmessage = async (ev: MessageEvent) => {
      try {
        let raw: string;
        if (typeof ev.data === 'string') {
          raw = ev.data;
        } else if (ev.data instanceof Blob) {
          raw = await ev.data.text();
        } else if (ev.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(ev.data);
        } else {
          return;
        }
        if (!raw || raw.length === 0) return;

        if (!authed) {
          const msg = JSON.parse(raw);
          if (msg.authOk) {
            authed = true;
            open = true;
            ws?.send(
              JSON.stringify({
                setup: {
                  model: MODEL,
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: opts.voice ?? 'Puck' },
                      },
                    },
                  },
                  ...(opts.systemInstruction
                    ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
                    : {}),
                },
              }),
            );
            opts.onEvent({ type: 'open' });
          } else if (msg.authError) {
            opts.onEvent({ type: 'error', message: `Auth failed: ${msg.authError}` });
            ws?.close();
          }
          return;
        }

        const msg = JSON.parse(raw);
        if (msg._upstreamClose) {
          opts.onEvent({ type: 'error', message: `Gemini closed: code=${msg.code} reason=${msg.reason}` });
          return;
        }
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
    ws.onerror = () => {
      opts.onEvent({
        type: 'error',
        message: "WebSocket error — the connection to the voice proxy was rejected.",
      });
    };
    ws.onclose = (ev) => {
      open = false;
      const reason = ev.reason || `code ${ev.code}`;
      if (ev.code !== 1000) {
        opts.onEvent({ type: 'error', message: `Voice session closed: ${reason}` });
      }
      opts.onEvent({ type: 'close' });
    };
  })();

  return {
    sendAudioChunk: (pcm16Base64: string) => {
      if (!open || !ws) return;
      ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: pcm16Base64 }],
          },
        }),
      );
    },
    sendText: (text: string) => {
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
    close: () => {
      ws?.close();
      ws = null;
      open = false;
    },
    isOpen: () => open,
  };
}

function createMockSession(opts: VoiceSessionOptions): VoiceSession {
  let open = false;
  setTimeout(() => {
    open = true;
    opts.onEvent({ type: 'open' });
  }, 300);
  return {
    sendAudioChunk: () => {},
    sendText: (text: string) => {
      if (!open) return;
      setTimeout(() => {
        opts.onEvent({ type: 'text', text: `[mock] You said: "${text}". LifeOS would respond here.` });
        opts.onEvent({ type: 'turnComplete' });
      }, 800);
    },
    close: () => {
      open = false;
      opts.onEvent({ type: 'close' });
    },
    isOpen: () => open,
  };
}
