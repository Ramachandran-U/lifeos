import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refresh the Supabase session cookie on every request. Without this, the
 * SSR client can serve stale auth state once the underlying JWT expires
 * (~1h default), and protected pages random-401 until the user manually
 * reloads. Pattern from @supabase/ssr docs.
 *
 * The matcher below skips Next static assets and the OAuth callback route —
 * everything else flows through.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const c of toSet) req.cookies.set(c.name, c.value);
          res = NextResponse.next({ request: req });
          for (const c of toSet) res.cookies.set(c.name, c.value, c.options);
        },
      },
    },
  );

  // getUser() forces a token refresh if needed and writes the new cookies
  // back to `res` via the setAll hook above. Do not remove.
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: [
    /*
     * Match every request except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (extensions)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
