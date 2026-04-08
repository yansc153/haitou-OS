import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/landing');
  }

  const { data: draft } = await supabase
    .from('onboarding_draft')
    .select('status, answered_fields')
    .eq('user_id', user.id)
    .single();

  if (!draft || draft.status !== 'completed') {
    const step = (draft?.answered_fields as Record<string, unknown>)?.current_step as number ?? 1;
    const routes: Record<number, string> = { 1: '/resume', 2: '/setup', 3: '/extension', 4: '/activation' };
    redirect(routes[step] || '/resume');
  }

  redirect('/home');
}
