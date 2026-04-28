'use client';

import { useEffect, useState } from 'react';
import { listFlags, patchFlag, type Flag } from '@/lib/worker';

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setFlags(await listFlags());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onToggle = async (f: Flag) => {
    if (f.type !== 'bool') return;
    setBusy(f.key);
    try {
      const next = !(f.default_value as boolean);
      await patchFlag(f.key, { default_value: next as unknown as Flag['default_value'] });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'patch failed');
    } finally {
      setBusy(null);
    }
  };

  const onKill = async (f: Flag) => {
    setBusy(f.key);
    try {
      await patchFlag(f.key, { status: f.status === 'killed' ? 'active' : 'killed' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'kill failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22 }}>Feature flags</h1>
      <p style={{ color: '#A8A8C0', marginTop: 6, fontSize: 14 }}>
        Consumer apps refresh from <code>/v1/config</code> within 5 minutes of any change.
      </p>

      {error ? (
        <div style={{ margin: '16px 0', padding: 12, border: '1px solid #FF4444', borderRadius: 8, color: '#FF4444' }}>
          {error}
        </div>
      ) : null}

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Default</th>
            <th>Status</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.id}>
              <td>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{f.key}</div>
                {f.description ? <div style={{ color: '#A8A8C0', fontSize: 12, marginTop: 2 }}>{f.description}</div> : null}
              </td>
              <td style={{ color: '#A8A8C0', fontSize: 12 }}>{f.type}</td>
              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{JSON.stringify(f.default_value)}</td>
              <td>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    border: `1px solid ${f.status === 'killed' ? '#FF4444' : '#7EE0B8'}`,
                    color: f.status === 'killed' ? '#FF4444' : '#7EE0B8',
                  }}
                >
                  {f.status}
                </span>
              </td>
              <td style={{ color: '#A8A8C0', fontSize: 12 }}>
                {f.updated_by || '—'}<br />
                {new Date(f.updated_at).toLocaleString()}
              </td>
              <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {f.type === 'bool' ? (
                  <button onClick={() => onToggle(f)} disabled={busy === f.key}>
                    Toggle
                  </button>
                ) : null}
                <button onClick={() => onKill(f)} disabled={busy === f.key}>
                  {f.status === 'killed' ? 'Restore' : 'Kill'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
