'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Supabase Realtime subscription hook.
 *
 * Channels per spec (BACKEND_API_AND_ARCHITECTURE_SPEC.md § Realtime):
 * - timeline_event INSERT → live feed on Home
 * - team UPDATE → runtime status changes
 * - handoff INSERT/UPDATE → handoff count badge
 *
 * Reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s
 */

type RealtimeEvent<T = Record<string, unknown>> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
};

/**
 * Subscribe to timeline_event INSERTs for a team's live feed.
 */
export function useTimelineFeed(
  teamId: string | undefined,
  onNewEvent: (event: Record<string, unknown>) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onNewEvent);
  callbackRef.current = onNewEvent;

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`feed:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'timeline_event',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.visibility === 'feed') {
            callbackRef.current(row);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [teamId, supabase]);
}

/**
 * Subscribe to team runtime_status changes.
 */
export function useTeamStatus(
  teamId: string | undefined,
  onStatusChange: (newStatus: string) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`team:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'team',
          filter: `id=eq.${teamId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.runtime_status) {
            callbackRef.current(row.runtime_status as string);
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [teamId, supabase]);
}

/**
 * Subscribe to agent_instance changes — status, task count, last_active_at.
 */
export function useAgentUpdates(
  teamId: string | undefined,
  onAgentChange: (agent: Record<string, unknown>) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const callbackRef = useRef(onAgentChange);
  callbackRef.current = onAgentChange;

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`agents:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_instance',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          callbackRef.current(payload.new as Record<string, unknown>);
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [teamId, supabase]);
}

/**
 * Subscribe to ALL timeline_event INSERTs (not just feed-visible).
 * Used for agent card terminal logs.
 */
export function useAllTimelineEvents(
  teamId: string | undefined,
  onNewEvent: (event: Record<string, unknown>) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const callbackRef = useRef(onNewEvent);
  callbackRef.current = onNewEvent;

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`all-events:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'timeline_event',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          callbackRef.current(payload.new as Record<string, unknown>);
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [teamId, supabase]);
}

/**
 * Subscribe to handoff changes (new handoffs or state updates).
 */
export function useHandoffUpdates(
  teamId: string | undefined,
  onUpdate: (event: { type: 'INSERT' | 'UPDATE'; handoff: Record<string, unknown> }) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`handoffs:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'handoff',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          callbackRef.current({ type: 'INSERT', handoff: payload.new as Record<string, unknown> });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'handoff',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          callbackRef.current({ type: 'UPDATE', handoff: payload.new as Record<string, unknown> });
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [teamId, supabase]);
}
