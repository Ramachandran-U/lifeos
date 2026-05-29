'use client';

import { useEffect, useState } from 'react';
import { getUsers, type UsersResponse } from '@/lib/worker';

const FILTERS: Array<{ label: string; value: UsersResponse['filter']; color: string }> = [
  { label: 'All',       value: 'all',       color: '#A8A8C0' },
  { label: 'Active',    value: 'active',    color: '#00C896' },
  { label: 'Superuser', value: 'superuser', color: '#A855F7' },
  { label: 'Stuck',     value: 'stuck',     color: '#FF5577' },
];

const BUCKET_COLORS: Record<string, string> = {
  active:    '#00C896',
  superuser: '#A855F7',
  stuck:     '#FF5577',
  inactive:  '#6B6B88',
};

const WINDOWS = [7, 30, 90] as const;

export default function UsersPage() {
  const [filter, setFilter] = useState<UsersResponse['filter']>('all');
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await getUsers(filter, days));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter, days]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Users</h1>
          <div style={{ color: '#6B6B88', fontSize: 12, marginTop: 4 }}>
            Anonymous device aggregates · no PII · last {days} days
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
              {w}d
            </button>
          ))}
        </div>
      </div>

      {data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <CountTile label="Total" value={data.totals.all} color="#FFF" />
          <CountTile label="Active (3d)" value={data.totals.active} color={BUCKET_COLORS.active} />
          <CountTile label="Superusers" value={data.totals.superuser} color={BUCKET_COLORS.superuser} />
          <CountTile label="Stuck onboarding" value={data.totals.stuck} color={BUCKET_COLORS.stuck} />
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            disabled={filter === f.value}
            style={{
              padding: '6px 12px',
              background: filter === f.value ? f.color : 'transparent',
              color: filter === f.value ? '#0D0D0D' : f.color,
              border: `1px solid ${f.color}`,
              borderRadius: 6,
              cursor: filter === f.value ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div style={{ color: '#A8A8C0', marginBottom: 16 }}>Loading…</div> : null}

      {data && data.users.length === 0 && !loading ? (
        <div style={{ color: '#6B6B88', fontSize: 13 }}>No devices in this view.</div>
      ) : null}

      {data && data.users.length > 0 ? (
        <div style={{ background: '#1A1A2E', border: '1px solid #2E2E4A', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 0.7fr 0.6fr 0.6fr 0.6fr',
            padding: '10px 12px', gap: 8,
            fontSize: 10, color: '#6B6B88', textTransform: 'uppercase', letterSpacing: 0.5,
            borderBottom: '1px solid #2E2E4A',
          }}>
            <div>Device</div>
            <div>Bucket</div>
            <div>First seen</div>
            <div>Last seen</div>
            <div>Stage</div>
            <div>Events</div>
            <div>Fdbk</div>
            <div>Plat</div>
          </div>
          {data.users.map((u) => (
            <div key={u.device_id} style={{
              display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 0.7fr 0.6fr 0.6fr 0.6fr',
              padding: '10px 12px', gap: 8, fontSize: 12,
              borderBottom: '1px solid #2E2E4A', alignItems: 'center',
            }}>
              <div style={{ fontFamily: 'monospace', color: '#A8A8C0', fontSize: 11 }}>
                {u.device_id.slice(0, 16)}…
              </div>
              <div style={{ color: BUCKET_COLORS[u.bucket], fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                {u.bucket}
              </div>
              <div style={{ color: '#A8A8C0' }}>{shortDate(u.first_seen)}</div>
              <div style={{ color: '#A8A8C0' }}>{shortDate(u.last_seen)}</div>
              <div style={{ color: u.finished_onboarding ? '#00C896' : '#F4C16A', fontSize: 11 }}>
                {u.onboarding_stage ?? '—'}
              </div>
              <div style={{ color: '#FFF' }}>{u.event_count.toLocaleString()}</div>
              <div style={{ color: u.feedback_count > 0 ? '#7FB8FF' : '#6B6B88' }}>{u.feedback_count}</div>
              <div style={{ color: '#A8A8C0', fontSize: 11 }}>{u.platform ?? '—'}</div>
            </div>
          ))}
        </div>
      ) : null}

      {data?.truncated ? (
        <div style={{ color: '#F4C16A', fontSize: 12, marginTop: 12 }}>
          Showing first 500 devices. Narrow the window or filter to see fewer.
        </div>
      ) : null}
    </div>
  );
}

function CountTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 16, background: '#1A1A2E',
      border: `1px solid ${color === '#FFF' ? '#2E2E4A' : color}`, borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, color: '#A8A8C0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color, marginTop: 4 }}>{value.toLocaleString()}</div>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffHours = (now - d.getTime()) / 3_600_000;
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`;
  return d.toLocaleDateString();
}
