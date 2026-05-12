'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('magic');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string>('');

  const submit = async () => {
    setStatus('busy');
    setErrMsg('');
    const supabase = browserClient();

    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus('error');
        setErrMsg(error.message);
      } else {
        router.replace('/flags');
        router.refresh();
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/flags` },
    });
    if (error) {
      setStatus('error');
      setErrMsg(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: '12vh auto', padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>LifeOS Admin</h1>
      <p style={{ color: '#A8A8C0', marginTop: 8 }}>
        Operations portal. Only emails listed in the admins table can access anything.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 24, fontSize: 13 }}>
        <button onClick={() => setMode('password')} disabled={mode === 'password'}>
          Password
        </button>
        <button onClick={() => setMode('magic')} disabled={mode === 'magic'}>
          Magic link
        </button>
      </div>

      {status === 'sent' ? (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid #2E2E4A', borderRadius: 12 }}>
          Check <strong>{email}</strong> for a sign-in link.
        </div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode === 'password' ? (
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          <button
            onClick={submit}
            disabled={!email || (mode === 'password' && !password) || status === 'busy'}
          >
            {status === 'busy' ? '…' : mode === 'password' ? 'Sign in' : 'Send link'}
          </button>
        </div>
      )}
      {errMsg ? <div style={{ marginTop: 12, color: '#FF4444' }}>{errMsg}</div> : null}
    </main>
  );
}
