'use client';

import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      style={{ marginTop: 12, width: '100%' }}
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace('/sign-in');
      }}
    >
      Sign out
    </button>
  );
}
