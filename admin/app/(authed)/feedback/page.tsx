'use client';

import { useEffect, useState } from 'react';
import {
  listFeedback,
  patchFeedback,
  type FeedbackRow,
  type FeedbackStatus,
} from '@/lib/worker';

const STATUS_FILTERS: Array<{ label: string; value: FeedbackStatus | 'all' }> = [
  { label: 'New',       value: 'new' },
  { label: 'Triaged',   value: 'triaged' },
  { label: 'Responded', value: 'responded' },
  { label: 'Closed',    value: 'closed' },
  { label: 'All',       value: 'all' },
];

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new:       '#FF5577',
  triaged:   '#F4C16A',
  responded: '#7FB8FF',
  closed:    '#6B6B88',
};

export default function FeedbackPage() {
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('new');
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Draft triage notes per row, keyed by id. The column + PATCH support have
  // existed since migration 0004 — this is the first UI that exposes them.
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      setRows(await listFeedback(filter === 'all' ? undefined : filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const updateStatus = async (id: number, status: FeedbackStatus) => {
    setBusyId(id);
    try {
      await patchFeedback(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'patch failed');
    } finally {
      setBusyId(null);
    }
  };

  const saveNote = async (id: number) => {
    const draft = noteDrafts[id];
    if (draft === undefined) return;
    setBusyId(id);
    try {
      await patchFeedback(id, { notes: draft });
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'note save failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Feedback</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              disabled={filter === f.value}
              style={{
                padding: '6px 12px',
                background: filter === f.value ? '#5B4FE8' : 'transparent',
                color: filter === f.value ? '#FFF' : '#A8A8C0',
                border: '1px solid #2E2E4A',
                borderRadius: 6,
                cursor: filter === f.value ? 'default' : 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div style={{ color: '#FF4444', marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div style={{ color: '#A8A8C0', marginBottom: 16 }}>Loading…</div> : null}

      {rows.length === 0 && !loading ? (
        <div style={{ color: '#6B6B88', fontSize: 13 }}>No feedback in this view.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => {
            const isOpen = openId === r.id;
            return (
              <div key={r.id} style={{ border: '1px solid #2E2E4A', borderRadius: 8 }}>
                <button
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'transparent',
                    border: 'none', cursor: 'pointer', color: '#FFF', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: STATUS_COLORS[r.status], fontWeight: 600, textTransform: 'uppercase' }}>{r.status}</span>
                    <span style={{ color: '#6B6B88' }}>·</span>
                    <span style={{ color: '#A8A8C0' }}>{new Date(r.received_at).toLocaleString()}</span>
                    {r.platform ? <><span style={{ color: '#6B6B88' }}>·</span><span style={{ color: '#A8A8C0' }}>{r.platform}</span></> : null}
                    {r.app_version ? <><span style={{ color: '#6B6B88' }}>·</span><span style={{ color: '#A8A8C0' }}>v{r.app_version}</span></> : null}
                    <span style={{ marginLeft: 'auto', color: '#6B6B88' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {r.subject || r.body.slice(0, 80) + (r.body.length > 80 ? '…' : '')}
                  </div>
                  {r.from_email ? (
                    <div style={{ fontSize: 12, color: '#7FB8FF', fontFamily: 'monospace' }}>{r.from_email}</div>
                  ) : null}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #2E2E4A' }}>
                    <pre style={{
                      fontSize: 13, background: '#1A1A2E', padding: 12, borderRadius: 6,
                      color: '#F4EFFF', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      margin: '12px 0', maxHeight: 400, overflow: 'auto',
                    }}>
                      {r.body}
                    </pre>
                    <div style={{ margin: '0 0 12px' }}>
                      <div style={{ fontSize: 11, color: '#6B6B88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Triage note (admin-only)
                      </div>
                      <textarea
                        value={noteDrafts[r.id] ?? r.notes ?? ''}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Why it was triaged this way, links, follow-ups…"
                        rows={2}
                        style={{
                          width: '100%', boxSizing: 'border-box', background: '#1A1A2E',
                          color: '#F4EFFF', border: '1px solid #2E2E4A', borderRadius: 6,
                          padding: 8, fontSize: 13, resize: 'vertical',
                        }}
                      />
                      {noteDrafts[r.id] !== undefined && noteDrafts[r.id] !== (r.notes ?? '') ? (
                        <button
                          onClick={() => saveNote(r.id)}
                          disabled={busyId === r.id}
                          style={{
                            marginTop: 6, padding: '6px 12px', background: 'transparent',
                            color: '#7FB8FF', border: '1px solid #7FB8FF', borderRadius: 6,
                            cursor: 'pointer', fontSize: 12,
                          }}
                        >
                          {busyId === r.id ? 'Saving…' : 'Save note'}
                        </button>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['triaged', 'responded', 'closed'] as FeedbackStatus[])
                        .filter((s) => s !== r.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(r.id, s)}
                            disabled={busyId === r.id}
                            style={{
                              padding: '6px 12px', background: 'transparent',
                              color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}`,
                              borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            Mark {s}
                          </button>
                        ))}
                      {r.from_email ? (
                        <a
                          href={`mailto:${r.from_email}?subject=Re: ${encodeURIComponent(r.subject || 'Your LifeOS feedback')}`}
                          style={{
                            padding: '6px 12px', background: '#5B4FE8', color: '#FFF',
                            borderRadius: 6, fontSize: 12, textDecoration: 'none',
                          }}
                        >
                          Reply via email
                        </a>
                      ) : null}
                    </div>
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
