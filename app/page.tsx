import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/landing');
  }

  // V2 simplified routing: no team → /resume, has team → /home
  const { data: draft } = await supabase
    .from('onboarding_draft')
    .select('status')
    .eq('user_id', user.id)
    .single();

  if (!draft || draft.status !== 'completed') {
    redirect('/resume');
  }

  redirect('/home');
}
