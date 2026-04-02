/**
 * Shared helpers for handoff mutation endpoints.
 * Validates ownership, loads handoff, enforces state machine.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Handoff state machine (mirrors src/shared/state-machines.ts)
const HANDOFF_TRANSITIONS: Record<string, string[]> = {
  awaiting_takeover: ['in_user_handling'],
  in_user_handling: ['waiting_external', 'resolved', 'returned_to_team', 'closed'],
  waiting_external: ['in_user_handling', 'resolved', 'closed'],
  resolved: ['closed'],
  returned_to_team: ['closed'],
};

export function validateHandoffTransition(current: string, target: string): { valid: boolean; error?: string } {
  const allowed = HANDOFF_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    return { valid: false, error: `Illegal handoff transition: ${current} → ${target}` };
  }
  return { valid: true };
}

export async function loadHandoffWithOwnership(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  handoffId: string
) {
  // Verify team ownership
  const { data: team } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!team) return { handoff: null, error: 'No team found' };

  const { data: handoff } = await serviceClient
    .from('handoff')
    .select('*')
    .eq('id', handoffId)
    .eq('team_id', team.id)
    .single();

  if (!handoff) return { handoff: null, error: 'Handoff not found' };

  return { handoff, error: null, teamId: team.id };
}
