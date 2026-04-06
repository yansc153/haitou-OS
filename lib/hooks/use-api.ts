import type { SupabaseClient, Session } from '@supabase/supabase-js';

/**
 * Get a valid session, auto-refreshing if token expires within 2 minutes.
 * Redirects to /login if no session at all.
 */
export async function getValidSession(supabase: SupabaseClient): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt - now < 120) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    return refreshed;
  }
  return session;
}
