import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function serverClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const c of toSet) cookieStore.set(c.name, c.value, c.options);
        },
      },
    },
  );
}
