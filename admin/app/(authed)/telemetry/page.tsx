'use client';

import { useEffect, useState } from 'react';
import { getFunnel, getRecentEvents, type FunnelResponse, type RecentEvent } from '@/lib/worker';

const WINDOW_OPTIONS = [1, 7, 30] as const;

export default function TelemetryPage() {
  const [days, setDays] = useState<number>(7);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const load = async (windowDays: number) => {
    setError(null);
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFunnel(windowDays), getRecentEvents(50)]);
      setFunnel(f);
      setRecent(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const topStageDevices = funnel?.stages[0]?.devices ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Telemetry</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              disabled={days === w}
              style={{
                padding: '6px 12px',
                background: days === w ? '#5B4FE8' : 'transparent',
                color: days === w ? '#FFF' : '#A8A8C0',
                border: '1px solid #2E2E4A',
                borderRadius: 6,
                cursor: days === w ? 'default' : 'pointer',
              }}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <p style={{ color: '#A8A8C0', marginBottom: 24, fontSize: 13 }}>
        Anonymous opt-in events from the consumer app. Distinct devices at each funnel stage in the
        trailing window. Sample size: {funnel?.sample_size ?? 0} events.
      </p>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div style={{ color: '#A8A8C0', marginBottom: 16 }}>Loading…</div> : null}

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Funnel</h2>
        {funnel === null || funnel.stages.every((s) => s.devices === 0) ? (
          <div style={{ color: '#6B6B88', fontSize: 13 }}>
            No telemetry yet for this window. Either no users have opted in, or none have done these
            actions recently.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnel.stages.map((s) => {
              const pct = topStageDevices > 0 ? Math.round((s.devices / topStageDevices) * 100) : 0;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 160, fontSize: 13 }}>{s.label}</div>
                  <div style={{ flex: 1, position: 'relative', height: 24, background: '#1A1A2E', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        background: '#5B4FE8',
                      }}
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 12, color: '#FFF', fontVariantNumeric: 'tabular-nums' }}>
                      {s.devices} ({pct}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Recent events (last 50)</h2>
        {recent.length === 0 ? (
          <div style={{ color: '#6B6B88', fontSize: 13 }}>No events yet.</div>
        ) : (
          <div style={{ border: '1px solid #2E2E4A', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#1A1A2E', textAlign: 'left' }}>
                  <th style={th}>Time</th>
                  <th style={th}>Event</th>
                  <th style={th}>Device</th>
                  <th style={th}>Platform</th>
                  <th style={th}>Props</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #2E2E4A' }}>
                    <td style={td}>{new Date(e.ts).toLocaleString()}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#A584FF' }}>{e.event}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#6B6B88' }}>
                      {e.device_id.slice(0, 8)}…
                    </td>
                    <td style={td}>{e.platform ?? '-'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#A8A8C0', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {Object.keys(e.props).length > 0 ? JSON.stringify(e.props) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const th = { padding: '8px 12px', fontWeight: 600 as const, color: '#A8A8C0' };
const td = { padding: '8px 12px' };
