import type { Env } from './index';

// CF Workers' fetch() requires https:// (not wss://) for outbound WebSocket
// upgrades — the Upgrade header handles the protocol switch.
const GEMINI_WS = 'https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export async function proxyGeminiLive(
  req: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  // Simple per-minute guard; a full voice-minute meter lives in the client
  // (sending a 'voiceMinuteTick' every 60s). Here we just gate concurrent
  // sessions per user by writing a KV flag, best-effort.
  const lockKey = `voice-lock:${userId}`;
  const existing = await env.RATE_LIMIT.get(lockKey);
  if (existing) {
    return new Response('another voice session active', { status: 429 });
  }
  await env.RATE_LIMIT.put(lockKey, '1', { expirationTtl: 60 });

  const upstreamUrl = `${GEMINI_WS}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let upstreamWs: WebSocket | null = null;
  try {
    const upstreamResp = await fetch(upstreamUrl, {
      headers: { Upgrade: 'websocket' },
    });
    upstreamWs = upstreamResp.webSocket;
  } catch {
    upstreamWs = null;
  }
  if (!upstreamWs) {
    // Release the lock so the user can retry immediately — otherwise a failed
    // upstream handshake blocks the next attempt for the full 60s TTL.
    await env.RATE_LIMIT.delete(lockKey).catch(() => {});
    return new Response('upstream did not upgrade', { status: 502 });
  }
  upstreamWs.accept();

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  (server as WebSocket).accept();

  // Pipe both directions. Any close/error tears down both sockets and the
  // per-user lock so another session can start.
  const teardown = async () => {
    try { upstreamWs.close(); } catch {}
    try { (server as WebSocket).close(); } catch {}
    await env.RATE_LIMIT.delete(lockKey).catch(() => {});
  };

  (server as WebSocket).addEventListener('message', (e) => {
    try { upstreamWs.send(e.data); } catch {}
  });
  upstreamWs.addEventListener('message', (e) => {
    try { (server as WebSocket).send(e.data); } catch {}
  });
  (server as WebSocket).addEventListener('close', teardown);
  (server as WebSocket).addEventListener('error', teardown);
  upstreamWs.addEventListener('close', teardown);
  upstreamWs.addEventListener('error', teardown);

  return new Response(null, { status: 101, webSocket: client });
}
