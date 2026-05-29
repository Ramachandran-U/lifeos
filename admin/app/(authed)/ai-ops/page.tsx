'use client';

import { useEffect, useState } from 'react';
import {
  getAiOps,
  getAiOpsFailures,
  type AiOpsResponse,
  type AiOpsFailureSample,
} from '@/lib/worker';

const WINDOWS = [1, 7, 30] as const;

export default function AiOpsPage() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<AiOpsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, AiOpsFailureSample[]>>({});
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);

  const load = async (w: number) => {
    setError(null);
    setLoading(true);
    try {
      setData(await getAiOps(w));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    setSamples({});
  }, [days]);

  const toggleTask = async (task: string) => {
    if (openTask === task) {
      setOpenTask(null);
      return;
    }
    setOpenTask(task);
    if (samples[task]) return;
    setSampleLoading(task);
    try {
      const res = await getAiOpsFailures(task, days);
      setSamples((s) => ({ ...s, [task]: res.samples }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failures load failed');
    } finally {
      setSampleLoading(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>AI Operations</h1>
          <div style={{ color: '#6B6B88', fontSize: 12, marginTop: 4 }}>
            Calls · failures · cost · eval pass-rate, per task
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {WINDOWS.map((w) => (
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
              {w === 1 ? '24h' : `${w}d`}
            </button>
          ))}
        </div>
      </div>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {loading && !data ? <div style={{ color: '#A8A8C0' }}>Loading…</div> : null}

      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Totals row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Stat label="Calls" value={data.totals.calls.toLocaleString()} />
            <Stat
              label="Failure rate"
              value={`${(data.totals.failure_rate * 100).toFixed(2)}%`}
              sub={`${data.totals.failures} schema failures`}
              accent={data.totals.failure_rate > 0.02 ? '#FF5577' : undefined}
            />
            <Stat label="Cost (est.)" value={`₹${data.totals.cost_inr.toFixed(2)}`} sub="Gemini pricing" />
            <Stat
              label="Latest eval"
              value={
                data.evals[0] ? `${(data.evals[0].pass_rate * 100).toFixed(0)}%` : '—'
              }
              sub={
                data.evals[0]
                  ? `${data.evals[0].branch} · ${data.evals[0].commit_sha} · ${data.evals[0].mode}`
                  : 'no reports'
              }
              accent={
                data.evals[0] && data.evals[0].pass_rate < 0.8 ? '#FF5577' : undefined
              }
            />
          </div>

          {/* Per-task table */}
          <Card title="By task" subtitle="Sorted by failure rate · click a row to see recent failures">
            {data.tasks.length === 0 ? (
              <div style={{ color: '#6B6B88', fontSize: 13, padding: '12px 0' }}>No AI calls in this window.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Header />
                {data.tasks.map((t) => {
                  const isOpen = openTask === t.task;
                  const rowAccent = t.failure_rate > 0.05 ? '#FF5577' : t.failure_rate > 0.01 ? '#F4C16A' : '#A8A8C0';
                  return (
                    <div key={t.task} style={{ borderTop: '1px solid #2E2E4A' }}>
                      <button
                        onClick={() => toggleTask(t.task)}
                        style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr 0.5fr',
                          alignItems: 'center', padding: '10px 4px', width: '100%',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#FFF', textAlign: 'left', gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.task}</div>
                          <div style={{ fontSize: 10, color: '#6B6B88' }}>{t.models.join(', ')}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#A8A8C0' }}>{t.calls.toLocaleString()}</div>
                        <div style={{ fontSize: 13, color: rowAccent, fontWeight: 600 }}>
                          {(t.failure_rate * 100).toFixed(2)}%{' '}
                          <span style={{ color: '#6B6B88', fontWeight: 400, fontSize: 11 }}>
                            ({t.failures})
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#A8A8C0' }}>
                          in {t.avg_input_tokens.toLocaleString()} · out {t.avg_output_tokens.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, color: '#A8A8C0' }}>₹{t.est_cost_inr.toFixed(2)}</div>
                        <div style={{ fontSize: 13, color: '#6B6B88', textAlign: 'right' }}>{isOpen ? '▾' : '▸'}</div>
                      </button>
                      {isOpen ? (
                        <div style={{ padding: '0 8px 16px', background: '#0D0D0D' }}>
                          {sampleLoading === t.task ? (
                            <div style={{ color: '#A8A8C0', fontSize: 12, padding: 12 }}>Loading samples…</div>
                          ) : samples[t.task]?.length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                              {samples[t.task].map((s, i) => (
                                <div key={i} style={{ padding: 12, background: '#1A1A2E', borderRadius: 6, border: '1px solid #2E2E4A' }}>
                                  <div style={{ fontSize: 11, color: '#6B6B88', marginBottom: 4 }}>
                                    {new Date(s.ts).toLocaleString()}
                                    {s.platform ? ` · ${s.platform}` : ''}
                                    {s.app_version ? ` · v${s.app_version}` : ''}
                                    {s.schema ? ` · schema: ${s.schema}` : ''}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#FF8888', fontFamily: 'monospace', marginBottom: 6 }}>
                                    {s.error || '(no error message)'}
                                  </div>
                                  {s.raw_preview ? (
                                    <pre style={{
                                      fontSize: 11, background: '#0D0D0D', padding: 8, borderRadius: 4,
                                      color: '#A8A8C0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                      margin: 0, maxHeight: 200, overflow: 'auto',
                                    }}>{s.raw_preview}</pre>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#6B6B88', fontSize: 12, padding: 12 }}>No failure samples.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent evals */}
          <Card title="Recent eval reports" subtitle="Latest 10 across branches">
            {data.evals.length === 0 ? (
              <div style={{ color: '#6B6B88', fontSize: 13 }}>No eval reports yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.evals.map((e, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
                    gap: 12, padding: '8px 4px', fontSize: 12,
                    borderBottom: '1px solid #2E2E4A',
                  }}>
                    <div style={{ color: '#FFF' }}>{e.branch} <span style={{ color: '#6B6B88' }}>· {e.commit_sha}</span></div>
                    <div style={{ color: '#A8A8C0' }}>{e.mode}</div>
                    <div style={{ color: e.pass_rate < 0.8 ? '#FF5577' : '#FFF', fontWeight: 600 }}>
                      {(e.pass_rate * 100).toFixed(0)}%
                    </div>
                    <div style={{ color: '#A8A8C0' }}>{e.passed_cases}/{e.total_cases}</div>
                    <div style={{ color: '#6B6B88' }}>
                      {e.weakest_suite ? `weakest: ${e.weakest_suite.name} (${(e.weakest_suite.passRate * 100).toFixed(0)}%)` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      padding: 20, background: '#1A1A2E',
      border: `1px solid ${accent ?? '#2E2E4A'}`, borderRadius: 12,
    }}>
      <div style={{ fontSize: 12, color: '#A8A8C0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: accent ?? '#FFF', marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: '#6B6B88', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, background: '#1A1A2E', border: '1px solid #2E2E4A', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FFF' }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 11, color: '#6B6B88' }}>{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Header() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr 0.5fr',
      padding: '8px 4px', gap: 8,
      fontSize: 10, color: '#6B6B88', textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      <div>Task</div>
      <div>Calls</div>
      <div>Failure rate</div>
      <div>Avg tokens</div>
      <div>Cost</div>
      <div></div>
    </div>
  );
}
