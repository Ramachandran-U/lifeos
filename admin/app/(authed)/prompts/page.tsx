'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPrompts, type Prompt } from '@/lib/worker';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPrompts()
      .then(setPrompts)
      .catch((e) => setError(e instanceof Error ? e.message : 'load failed'));
  }, []);

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22 }}>Prompts</h1>
      <p style={{ color: '#A8A8C0', marginTop: 6, fontSize: 14 }}>
        System prompts the consumer app uses. New versions start as drafts; activate one to make it the canonical version.
        Consumer integration (live fetch) is deferred — for now the bundled prompt is still what ships.
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
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((p) => (
            <tr key={p.id}>
              <td>
                <Link
                  href={`/prompts/${encodeURIComponent(p.key)}`}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#C9A0FF' }}
                >
                  {p.key}
                </Link>
              </td>
              <td style={{ color: '#A8A8C0', fontSize: 13 }}>{p.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
