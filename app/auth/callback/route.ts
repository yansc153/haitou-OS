import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Ensure application-level user record exists
        const { data: existingUser } = await supabase
          .from('user')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingUser) {
          // Create user + onboarding draft in one go
          await supabase.from('user').insert({
            id: user.id,
            email: user.email!,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url,
            auth_provider: user.app_metadata?.provider || 'unknown',
            auth_provider_id: user.id,
          });

          await supabase.from('onboarding_draft').insert({
            user_id: user.id,
            status: 'resume_required',
          });
        }
      }

      // Redirect to root — page.tsx will route based on state
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
