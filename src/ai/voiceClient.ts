import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import type { AgentTool } from './agent/runtime';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true';

// Track the current stable native-audio model via the `-latest` alias instead
// of pinning the dated `preview-12-2025`, which Google's Live API has been
// closing mid-turn with code=1011 at a high rate since late May 2026 (known
// upstream issue — see Google AI Developers Forum). `-latest`, the two dated
// previews, and `gemini-3.1-flash-live-preview` are all visible to our key;
// `-latest` is the safe default. Override per-build via EXPO_PUBLIC_VOICE_MODEL
// (e.g. set it to `models/gemini-3.1-flash-live-preview` to try the newer live
// model) without touching code.
const MODEL =
  process.env.EXPO_PUBLIC_VOICE_MODEL ||
  'models/gemini-2.5-flash-native-audio-latest';

function buildWsUrl(): string {
  const base = PROXY_URL.replace(/^http/, 'ws');
  return `${base}/gemini-live`;
}

export type VoiceEvent =
  | { type: 'open' }
  | { type: 'audio'; pcmBase64: string }
  | { type: 'text'; text: string }
  /** Streamed transcription of what the *user* said (input audio). */
  | { type: 'inputTranscript'; text: string }
  /** The model's generation was interrupted by the user speaking (barge-in). */
  | { type: 'interrupted' }
  | { type: 'turnComplete' }
  | { type: 'error'; message: string }
  | { type: 'close' };

export interface VoiceSessionOptions {
  systemInstruction?: string;
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  /**
   * Read-only tools the model can call to ground its answers in the user's REAL
   * data (today's routine, goals, spending, …). Wired into the Gemini Live
   * session as functionDeclarations; tool calls are executed on-device here and
   * the results streamed back. Without these the voice agent has no knowledge of
   * the user's data — see `buildVoiceTools` in `agent/voiceTools.ts`.
   */
  tools?: AgentTool[];
  onEvent: (event: VoiceEvent) => void;
}

export interface VoiceSession {
  sendAudioChunk: (pcm16Base64: string) => void;
  /** Manual VAD: mark the start of a user utterance (auto-VAD is disabled). */
  markActivityStart: () => void;
  /** Manual VAD: mark the end of a user utterance → the model generates. */
  markActivityEnd: () => void;
  sendText: (text: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createVoiceSession(opts: VoiceSessionOptions): VoiceSession {
  if (USE_MOCK) return createMockSession(opts);

  let ws: WebSocket | null = null;
  let open = false;
  // Name → tool, for dispatching the model's function calls on-device.
  const toolMap = new Map((opts.tools ?? []).map((t) => [t.declaration.name, t]));

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
                  // Ask the server to transcribe both sides so the UI can show
                  // what it heard (input) and what it's saying (output) — without
                  // these, AUDIO-only turns surface no text and the user gets no
                  // confirmation they were heard.
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                  // Manual turn control: the client runs its own VAD (mic RMS in
                  // useVoice) and signals speech start/end explicitly. Server-side
                  // auto-VAD over the continuously-streamed mic was unreliable —
                  // it fragmented or never cleanly ended the turn, leaving the UI
                  // stuck at "thinking". Verified end-to-end against deployed
                  // Gemini: manual mode returns one clean, complete turn.
                  realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
                  // Function-calling: forward the read-only tool declarations so
                  // the model can call them to ground its answers. Calls are
                  // handled below and executed on-device — the proxy is a
                  // passthrough. Function-calling mode defaults to AUTO; we don't
                  // send a top-level toolConfig because the Live `setup` message
                  // doesn't reliably accept one (an unknown field can get the
                  // whole setup rejected), and AUTO is exactly what we want.
                  ...(opts.tools && opts.tools.length > 0
                    ? { tools: [{ functionDeclarations: opts.tools.map((t) => t.declaration) }] }
                    : {}),
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

        // Tool-use: the model asked to call one or more on-device tools. Run each
        // against the user's local data and stream the results back as a
        // toolResponse. The proxy executes nothing — tools run here, beside the
        // data, exactly like the text agent's runtime (see agent/runtime.ts). A
        // tool that throws (or an unknown name) returns an error to the model so
        // it can recover rather than hang the turn.
        if (msg.toolCall) {
          const calls: Array<{ id?: string; name: string; args?: Record<string, unknown> }> =
            msg.toolCall.functionCalls ?? [];
          const functionResponses: Array<{
            id?: string;
            name: string;
            response: Record<string, unknown>;
          }> = [];
          for (const call of calls) {
            const tool = toolMap.get(call.name);
            let response: Record<string, unknown>;
            if (!tool) {
              response = { error: `unknown tool: ${call.name}` };
            } else {
              try {
                response = { result: await tool.execute(call.args ?? {}) };
              } catch (err) {
                response = { error: err instanceof Error ? err.message : String(err) };
              }
            }
            functionResponses.push({ id: call.id, name: call.name, response });
          }
          ws?.send(JSON.stringify({ toolResponse: { functionResponses } }));
          return;
        }

        const sc = msg.serverContent;
        if (sc?.interrupted) opts.onEvent({ type: 'interrupted' });
        if (sc?.inputTranscription?.text) {
          opts.onEvent({ type: 'inputTranscript', text: sc.inputTranscription.text });
        }
        if (sc?.outputTranscription?.text) {
          opts.onEvent({ type: 'text', text: sc.outputTranscription.text });
        }
        const parts = sc?.modelTurn?.parts ?? [];
        for (const p of parts) {
          if (p.inlineData?.mimeType?.startsWith('audio/')) {
            opts.onEvent({ type: 'audio', pcmBase64: p.inlineData.data });
          } else if (p.text && !p.thought) {
            // Skip the model's reasoning: native-audio models stream their
            // thinking as text parts flagged `thought: true` (e.g. "Defining
            // user goal…"). The spoken reply is surfaced via outputTranscription
            // above, so thought text must never leak into the transcript panel.
            opts.onEvent({ type: 'text', text: p.text });
          }
        }
        if (sc?.turnComplete) opts.onEvent({ type: 'turnComplete' });
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
    markActivityStart: () => {
      if (!open || !ws) return;
      ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
    },
    markActivityEnd: () => {
      if (!open || !ws) return;
      ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
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
    markActivityStart: () => {},
    markActivityEnd: () => {},
    sendText: (text: string) => {
      if (!open) return;
      // Echo the user's words back as an input transcript, then stream a reply
      // through a realistic thinking → speaking → done cadence so the UI's
      // status states can be exercised in mock mode and e2e.
      opts.onEvent({ type: 'inputTranscript', text });
      setTimeout(() => {
        opts.onEvent({ type: 'text', text: `You said: "${text}". ` });
      }, 600);
      setTimeout(() => {
        opts.onEvent({ type: 'text', text: `Here's what LifeOS suggests for your day.` });
      }, 1100);
      setTimeout(() => {
        opts.onEvent({ type: 'turnComplete' });
      }, 1500);
    },
    close: () => {
      open = false;
      opts.onEvent({ type: 'close' });
    },
    isOpen: () => open,
  };
}
