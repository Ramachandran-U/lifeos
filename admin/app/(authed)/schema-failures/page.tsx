'use client';

import { useEffect, useState } from 'react';
import { getSchemaFailures, type SchemaFailureGroup, type SchemaFailuresResponse } from '@/lib/worker';

const WINDOW_OPTIONS = [1, 7, 30] as const;

export default function SchemaFailuresPage() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<SchemaFailuresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const load = async (windowDays: number) => {
    setError(null);
    setLoading(true);
    try {
      setData(await getSchemaFailures(windowDays));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const groupKey = (g: SchemaFailureGroup) => `${g.task}::${g.schema}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Schema failures</h1>
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
        Cases where the consumer app received an AI response that failed Zod validation. Grouped by
        AI function + schema. Sample size: {data?.sample_size ?? 0} failures (capped at 2000 per fetch).
      </p>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div style={{ color: '#A8A8C0', marginBottom: 16 }}>Loading…</div> : null}

      {data === null || data.groups.length === 0 ? (
        <div style={{ color: '#6B6B88', fontSize: 13 }}>
          No schema failures in this window. Either no users have opted in to telemetry, the
          consumer hasn't shipped the latest build, or every AI call has been well-formed.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.groups.map((g) => {
            const isOpen = openGroup === groupKey(g);
            return (
              <div key={groupKey(g)} style={{ border: '1px solid #2E2E4A', borderRadius: 8 }}>
                <button
                  onClick={() => setOpenGroup(isOpen ? null : groupKey(g))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#FFF',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontFamily: 'monospace', color: '#A584FF' }}>{g.task}</span>
                    <span style={{ color: '#6B6B88', fontSize: 12 }}>→</span>
                    <span style={{ fontFamily: 'monospace', color: '#7FB8FF' }}>{g.schema}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                    <span style={{ color: '#FF5577', fontWeight: 600 }}>{g.count} failures</span>
                    <span style={{ color: '#A8A8C0' }}>last: {new Date(g.last_seen).toLocaleString()}</span>
                    <span style={{ color: '#6B6B88' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #2E2E4A' }}>
                    {g.samples.map((s, idx) => (
                      <div key={idx} style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: '#6B6B88', marginBottom: 4 }}>
                          {new Date(s.ts).toLocaleString()}
                          {s.platform ? ` · ${s.platform}` : ''}
                          {s.app_version ? ` · v${s.app_version}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: '#FF8C3C', marginBottom: 8, fontFamily: 'monospace' }}>
                          {s.error || '(no error message)'}
                        </div>
                        <pre style={{
                          fontSize: 11,
                          background: '#1A1A2E',
                          padding: 12,
                          borderRadius: 6,
                          overflow: 'auto',
                          color: '#A8A8C0',
                          fontFamily: 'monospace',
                          margin: 0,
                          maxHeight: 200,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {s.raw_preview || '(empty)'}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
