import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Show landing page for unauthenticated users
    redirect('/landing');
  }

  // Check onboarding/team state to determine where to route
  const { data: draft } = await supabase
    .from('onboarding_draft')
    .select('status')
    .eq('user_id', user.id)
    .single();

  if (!draft || draft.status === 'resume_required' || draft.status === 'questions_in_progress') {
    redirect('/resume');
  }

  if (draft.status === 'ready_for_activation') {
    redirect('/complete');
  }

  const { data: team } = await supabase
    .from('team')
    .select('status')
    .eq('user_id', user.id)
    .single();

  if (!team || team.status === 'activation_pending') {
    redirect('/activation');
  }

  if (team.status === 'ready') {
    redirect('/readiness');
  }

  redirect('/home');
}
