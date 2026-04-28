import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/sign-in');
  redirect('/flags');
}
