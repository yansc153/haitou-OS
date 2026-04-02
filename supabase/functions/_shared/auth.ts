import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { err } from './response.ts';

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: err(401, 'AUTH_REQUIRED', 'Missing authorization header') };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: err(401, 'AUTH_REQUIRED', 'Invalid or expired session') };
  }

  return { user, error: null, supabase };
}

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
