import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase-server';
import { SignOutButton } from './SignOutButton';

const NAV: { label: string; href: string; enabled: boolean }[] = [
  { label: 'Overview',        href: '/overview',        enabled: true },
  { label: 'Flags',           href: '/flags',           enabled: true },
  { label: 'Prompts',         href: '/prompts',         enabled: true },
  { label: 'Telemetry',       href: '/telemetry',       enabled: true },
  { label: 'Schema failures', href: '/schema-failures', enabled: true },
  { label: 'Evals',           href: '/evals',           enabled: true },
  { label: 'Feedback',        href: '/feedback',        enabled: true },
  { label: 'Push',            href: '/push',            enabled: true },
  { label: 'Audit',           href: '#',                enabled: false },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, borderRight: '1px solid #2E2E4A', padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>LifeOS Admin</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={(item.enabled ? item.href : '#') as Route}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                color: item.enabled ? '#FFF' : '#6B6B88',
                pointerEvents: item.enabled ? 'auto' : 'none',
              }}
            >
              {item.label}
              {!item.enabled && <span style={{ fontSize: 11, marginLeft: 6, color: '#6B6B88' }}>soon</span>}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 32, fontSize: 12, color: '#A8A8C0' }}>
          {data.user.email}
        </div>
        <SignOutButton />
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
