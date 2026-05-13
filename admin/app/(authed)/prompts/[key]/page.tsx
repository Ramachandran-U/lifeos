'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getPrompt,
  createPromptVersion,
  activatePromptVersion,
  type Prompt,
  type PromptVersion,
} from '@/lib/worker';

export default function PromptDetailPage() {
  const params = useParams<{ key: string }>();
  const promptKey = decodeURIComponent(params.key);

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [draftBody, setDraftBody] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const data = await getPrompt(promptKey);
      setPrompt(data.prompt);
      setVersions(data.versions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  };

  useEffect(() => {
    load();
  }, [promptKey]);

  const onCreate = async () => {
    if (!draftBody.trim()) return;
    setBusy(true);
    try {
      await createPromptVersion(promptKey, draftBody, draftNotes || undefined);
      setDraftBody('');
      setDraftNotes('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setBusy(false);
    }
  };

  const onActivate = async (n: number) => {
    if (!confirm(`Activate v${n}? The current active version will be archived.`)) return;
    setBusy(true);
    try {
      await activatePromptVersion(promptKey, n);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'activate failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <a href="/prompts" style={{ color: '#A8A8C0', fontSize: 13 }}>← Back to prompts</a>
      <h1 style={{ margin: '8px 0 0', fontSize: 22, fontFamily: 'ui-monospace, monospace' }}>{promptKey}</h1>
      {prompt?.description ? (
        <p style={{ color: '#A8A8C0', marginTop: 6, fontSize: 14 }}>{prompt.description}</p>
      ) : null}

      {error ? (
        <div style={{ margin: '16px 0', padding: 12, border: '1px solid #FF4444', borderRadius: 8, color: '#FF4444' }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Versions</h2>
        <button onClick={() => setShowForm((s) => !s)} disabled={busy}>
          {showForm ? 'Cancel' : '+ New version'}
        </button>
      </div>

      {showForm ? (
        <div style={{ marginTop: 12, padding: 16, border: '1px solid #2E2E4A', borderRadius: 12 }}>
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Prompt body…"
            rows={14}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
          <input
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Notes (what changed, why)"
            style={{ marginTop: 8, width: '100%' }}
          />
          <div style={{ marginTop: 8, color: '#A8A8C0', fontSize: 12 }}>
            {draftBody.length} chars
          </div>
          <button onClick={onCreate} disabled={busy || !draftBody.trim()} style={{ marginTop: 8 }}>
            {busy ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      ) : null}

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>v</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td style={{ fontFamily: 'ui-monospace, monospace' }}>{v.version}</td>
              <td>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    border: `1px solid ${
                      v.status === 'active' ? '#7EE0B8' : v.status === 'archived' ? '#6B6B88' : '#F0B429'
                    }`,
                    color: v.status === 'active' ? '#7EE0B8' : v.status === 'archived' ? '#6B6B88' : '#F0B429',
                  }}
                >
                  {v.status}
                </span>
              </td>
              <td style={{ color: '#A8A8C0', fontSize: 12, maxWidth: 360 }}>{v.notes || '—'}</td>
              <td style={{ color: '#A8A8C0', fontSize: 12 }}>
                {v.created_by || '—'}<br />
                {new Date(v.created_at).toLocaleString()}
              </td>
              <td>
                {v.status !== 'active' ? (
                  <button onClick={() => onActivate(v.version)} disabled={busy}>
                    Activate
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {versions.map((v) => (
        <details key={v.id} style={{ marginTop: 12, padding: 12, border: '1px solid #2E2E4A', borderRadius: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>
            v{v.version} body ({v.body.length} chars)
          </summary>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              background: '#0D0D0D',
              borderRadius: 6,
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {v.body}
          </pre>
        </details>
      ))}
    </div>
  );
}
