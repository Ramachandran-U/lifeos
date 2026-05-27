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
    // Connection stage logging (visible in transcript during connect).
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
      // Send auth token as first message (in-band auth — avoids putting the
      // JWT in the URL where browsers/CDNs may reject long query strings).
      ws?.send(JSON.stringify({ auth: token }));
    };
    // Wait for auth confirmation before sending the Gemini setup. The worker
    // responds with {"authOk":true} after verifying the token, then we send
    // the model setup and transition to the listening state.
    let authed = false;
    const origOnMessage = async (ev: MessageEvent) => {
      try {
        let raw: string;
        if (typeof ev.data === 'string') {
          raw = ev.data;
        } else if (ev.data instanceof Blob) {
          raw = await ev.data.text();
        } else if (ev.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(ev.data);
        } else {
          return; // unknown data type, skip
        }
        if (!raw || raw.length === 0) return; // empty frame, skip

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
        // Surface upstream (Gemini) close reason if piped by the worker.
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
    ws.onmessage = origOnMessage;
    ws.onerror = () => {
      opts.onEvent({
        type: 'error',
        message: "WebSocket error — the connection to the voice proxy was rejected. This usually means the auth token is expired. Try signing out and back in.",
      });
    };
    ws.onclose = (ev) => {
      open = false;
      // Always surface the close details so we can diagnose silent disconnects.
      const reason = ev.reason || `code ${ev.code}`;
      if (ev.code !== 1000) {
        opts.onEvent({ type: 'error', message: `Voice session closed: ${reason}` });
      }
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
