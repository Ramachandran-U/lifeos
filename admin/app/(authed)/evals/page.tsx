'use client';

import { useEffect, useState } from 'react';
import { getLatestEvalReports, type EvalReport } from '@/lib/worker';

export default function EvalsPage() {
  const [reports, setReports] = useState<EvalReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      setReports(await getLatestEvalReports());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>AI evals</h1>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '6px 12px', background: 'transparent', color: '#A8A8C0', border: '1px solid #2E2E4A', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontSize: 12 }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: '#A8A8C0', marginBottom: 24, fontSize: 13 }}>
        Latest CI eval result per branch and mode. The workflow at
        <code style={{ color: '#A584FF', margin: '0 4px' }}>.github/workflows/evals.yml</code>
        writes these every time it runs. <strong>Mock mode</strong> covers schema validity and
        deterministic safety checks (PII echo, injection resistance). <strong>Live mode</strong>
        is gated by <code style={{ color: '#A584FF' }}>EVAL_REAL=true</code> and only runs locally.
      </p>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}

      {reports.length === 0 && !loading ? (
        <div style={{ color: '#6B6B88', fontSize: 13 }}>
          No eval reports yet. The CI workflow needs <code style={{ color: '#A584FF' }}>EVAL_REPORTER_URL</code> and{' '}
          <code style={{ color: '#A584FF' }}>EVAL_REPORTER_TOKEN</code> repo secrets configured to write here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reports.map((r) => {
            const pct = r.total_cases > 0 ? (r.passed_cases / r.total_cases) * 100 : 0;
            const hasFails = r.suites.some((s) => s.status === 'fail');
            return (
              <div key={r.id} style={{ border: '1px solid #2E2E4A', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'monospace', color: '#A584FF', fontWeight: 600 }}>{r.branch}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: r.mode === 'LIVE' ? '#FF8C3C' : '#2E2E4A',
                        color: r.mode === 'LIVE' ? '#FFF' : '#A8A8C0',
                      }}>{r.mode}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B6B88', marginTop: 4, fontFamily: 'monospace' }}>
                      {r.commit_sha.slice(0, 8)} · {new Date(r.generated_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: hasFails ? '#FF5577' : '#31E0A3' }}>
                      {pct.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#A8A8C0' }}>
                      {r.passed_cases}/{r.total_cases} cases
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {r.suites.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 16, color: s.status === 'pass' ? '#31E0A3' : '#FF5577' }}>
                        {s.status === 'pass' ? '✓' : '✗'}
                      </span>
                      <span style={{ fontFamily: 'monospace', color: '#A8A8C0', flex: 1 }}>{s.name}</span>
                      <span style={{ color: '#6B6B88' }}>
                        {(s.passRate * 100).toFixed(0)}% · threshold {(s.threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>

                {r.workflow_url && (
                  <div style={{ marginTop: 12 }}>
                    <a
                      href={r.workflow_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#7FB8FF', textDecoration: 'none' }}
                    >
                      View workflow run ↗
                    </a>
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
