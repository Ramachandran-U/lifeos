'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getOverview, type OverviewResponse } from '@/lib/worker';

const WINDOWS = [1, 7, 30] as const;

export default function OverviewPage() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (w: number) => {
    setError(null);
    setLoading(true);
    try {
      setData(await getOverview(w));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Overview</h1>
          {data ? (
            <div style={{ color: '#6B6B88', fontSize: 12, marginTop: 4 }}>
              Updated {new Date(data.generated_at).toLocaleTimeString()} · {data.sample_size.toLocaleString()} events sampled
            </div>
          ) : null}
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
          <button
            onClick={() => load(days)}
            disabled={loading}
            style={{
              padding: '6px 12px', background: 'transparent', color: '#A8A8C0',
              border: '1px solid #2E2E4A', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}

      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ─── Users + feedback row ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Stat label="DAU" value={data.users.dau} sub="distinct devices, 24h" />
            <Stat label={`WAU (${data.window_days}d)`} value={data.users.wau} sub="distinct devices" />
            <Stat
              label="Open feedback"
              value={data.feedback.new_count}
              sub="status: new"
              href="/feedback"
              accent={data.feedback.new_count > 0 ? '#FF5577' : undefined}
            />
            <Stat
              label="AI calls"
              value={data.ai.calls_7d}
              sub={`${data.window_days}d · ₹${data.ai.est_cost_inr_7d.toFixed(2)}`}
              href="/telemetry"
            />
          </div>

          {/* ─── Funnel ──────────────────────────────────────────────── */}
          <Card title="Activation funnel (v2)" subtitle={`${data.window_days}d · ${data.funnel.top_devices} entered`}>
            {data.funnel.stages.length === 0 || data.funnel.top_devices === 0 ? (
              <Empty>No funnel data in this window.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.funnel.stages.map((s) => (
                  <FunnelBar key={s.key} label={s.label} value={s.devices} pct={s.conversion_from_top} />
                ))}
              </div>
            )}
          </Card>

          {/* ─── Engagement + AI side by side ─────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Engagement" subtitle={`${data.window_days}d window`}>
              <KV label="Blocks completed yesterday" value={data.engagement.blocks_completed_yesterday.toLocaleString()} />
              <KV label={`Blocks completed (${data.window_days}d)`} value={data.engagement.blocks_completed_7d.toLocaleString()} />
              <KV
                label="Evening reflect adoption"
                value={`${(data.engagement.evening_reflect_rate_7d * 100).toFixed(0)}%`}
                sub="of WAU"
              />
            </Card>

            <Card title="AI health" subtitle={`${data.window_days}d window`}>
              <KV label="Calls" value={data.ai.calls_7d.toLocaleString()} />
              <KV
                label="Schema failure rate"
                value={`${(data.ai.schema_failure_rate_7d * 100).toFixed(2)}%`}
                sub={`${data.ai.schema_failures_7d} failures`}
                accent={data.ai.schema_failure_rate_7d > 0.02 ? '#FF5577' : undefined}
              />
              <KV label="Est. cost" value={`₹${data.ai.est_cost_inr_7d.toFixed(2)}`} sub="Gemini pricing" />
              <KV
                label="Latest eval"
                value={
                  data.ai.latest_eval
                    ? `${(data.ai.latest_eval.pass_rate * 100).toFixed(0)}%`
                    : '—'
                }
                sub={
                  data.ai.latest_eval
                    ? `${data.ai.latest_eval.branch} · ${data.ai.latest_eval.commit_sha} · ${data.ai.latest_eval.mode}`
                    : 'no reports yet'
                }
                href="/evals"
                accent={
                  data.ai.latest_eval && data.ai.latest_eval.pass_rate < 0.8
                    ? '#FF5577'
                    : undefined
                }
              />
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label, value, sub, href, accent,
}: { label: string; value: number; sub: string; href?: string; accent?: string }) {
  const body = (
    <div
      style={{
        padding: 20,
        background: '#1A1A2E',
        border: `1px solid ${accent ?? '#2E2E4A'}`,
        borderRadius: 12,
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 12, color: '#A8A8C0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: accent ?? '#FFF', marginTop: 6 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: '#6B6B88', marginTop: 4 }}>{sub}</div>
    </div>
  );
  return href ? <Link href={href as never} style={{ textDecoration: 'none' }}>{body}</Link> : body;
}

function Card({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function KV({
  label, value, sub, href, accent,
}: { label: string; value: string; sub?: string; href?: string; accent?: string }) {
  const row = (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '10px 0', borderBottom: '1px solid #2E2E4A',
    }}>
      <div>
        <div style={{ fontSize: 13, color: '#A8A8C0' }}>{label}</div>
        {sub ? <div style={{ fontSize: 11, color: '#6B6B88', marginTop: 2 }}>{sub}</div> : null}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: accent ?? '#FFF' }}>{value}</div>
    </div>
  );
  return href ? <Link href={href as never} style={{ textDecoration: 'none', display: 'block' }}>{row}</Link> : row;
}

function FunnelBar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A8C0', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: '#FFF' }}>
          {value.toLocaleString()} <span style={{ color: '#6B6B88' }}>({(pct * 100).toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: 8, background: '#0D0D0D', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(1, pct * 100)}%`, height: '100%',
          background: 'linear-gradient(90deg, #5B4FE8, #00B4D8)',
        }} />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#6B6B88', fontSize: 13, padding: '12px 0' }}>{children}</div>;
}
