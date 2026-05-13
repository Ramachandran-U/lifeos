'use client';

import { useEffect, useState } from 'react';
import { broadcastPush, getPushStats, type BroadcastResult, type PushStats } from '@/lib/worker';

export default function PushPage() {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [platform, setPlatform] = useState<'all' | 'ios' | 'android' | 'web'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setStats(await getPushStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'stats failed');
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const audienceCount = stats
    ? platform === 'all'
      ? stats.total
      : stats.by_platform[platform] ?? 0
    : 0;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const r = await broadcastPush({
        title: title.trim() || undefined,
        body: body.trim(),
        platform: platform === 'all' ? undefined : platform,
      });
      setResult(r);
      setConfirmOpen(false);
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'broadcast failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 8px' }}>Push broadcast</h1>
      <p style={{ color: '#A8A8C0', marginBottom: 24, fontSize: 13 }}>
        Sends an Expo push notification to every registered device. There is no undo. Test first by
        targeting a smaller platform cohort if you're not sure of the wording.
      </p>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {result ? (
        <div style={{
          padding: 12, border: '1px solid #31E0A3', borderRadius: 8,
          background: 'rgba(49,224,163,0.06)', color: '#31E0A3', marginBottom: 16, fontSize: 13,
        }}>
          Broadcast complete · {result.sent} sent · {result.failed} failed · {result.invalid} marked invalid
        </div>
      ) : null}

      <section style={{ border: '1px solid #2E2E4A', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 12px', color: '#A8A8C0', textTransform: 'uppercase', letterSpacing: 1 }}>
          Audience
        </h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <div>Total active: <strong style={{ color: '#A584FF' }}>{stats?.total ?? '…'}</strong></div>
          {stats &&
            Object.entries(stats.by_platform).map(([p, n]) => (
              <div key={p}>{p}: <strong>{n}</strong></div>
            ))}
        </div>
      </section>

      <section style={{ border: '1px solid #2E2E4A', borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 12px', color: '#A8A8C0', textTransform: 'uppercase', letterSpacing: 1 }}>
          Compose
        </h2>
        <label style={lbl}>Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Big update inside 🎉"
          maxLength={200}
          style={input}
        />
        <label style={lbl}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tap to read the changelog…"
          maxLength={1000}
          rows={4}
          style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <label style={{ ...lbl, margin: 0 }}>Platform:</label>
          {(['all', 'ios', 'android', 'web'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              disabled={platform === p}
              style={{
                padding: '4px 10px',
                background: platform === p ? '#5B4FE8' : 'transparent',
                color: platform === p ? '#FFF' : '#A8A8C0',
                border: '1px solid #2E2E4A', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!body.trim() || audienceCount === 0}
            style={{
              padding: '8px 16px',
              background: !body.trim() || audienceCount === 0 ? '#2E2E4A' : '#5B4FE8',
              color: '#FFF', border: 'none', borderRadius: 6,
              cursor: !body.trim() || audienceCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Send to {audienceCount} device{audienceCount === 1 ? '' : 's'}
          </button>
        </div>
      </section>

      {confirmOpen && (
        <div
          onClick={() => !sending && setConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#120A1E', border: '1px solid #2E2E4A', borderRadius: 12, padding: 24, maxWidth: 480 }}
          >
            <h3 style={{ margin: '0 0 12px' }}>Send to {audienceCount} {platform === 'all' ? '' : platform + ' '}devices?</h3>
            <p style={{ color: '#A8A8C0', fontSize: 13, marginBottom: 16 }}>This is irreversible. Make sure the message is good.</p>
            <div style={{ background: '#1A1A2E', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
              {title ? <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div> : null}
              <div style={{ color: '#A8A8C0' }}>{body}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
                style={{ padding: '8px 16px', background: 'transparent', color: '#A8A8C0', border: '1px solid #2E2E4A', borderRadius: 6, cursor: sending ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{ padding: '8px 16px', background: '#FF5577', color: '#FFF', border: 'none', borderRadius: 6, cursor: sending ? 'not-allowed' : 'pointer' }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, color: '#A8A8C0', marginBottom: 4, marginTop: 12 };
const input = {
  width: '100%',
  padding: '8px 12px',
  background: '#1A1A2E',
  border: '1px solid #2E2E4A',
  borderRadius: 6,
  color: '#FFF',
  fontSize: 13,
};
