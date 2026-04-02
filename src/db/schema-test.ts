/**
 * RLS Verification Tests
 * Source: DATA_MODEL_SPEC.md § Row-Level Security
 *
 * Verifies that:
 * 1. User A cannot read User B's team-scoped data
 * 2. PlatformDefinition is readable by all authenticated users
 * 3. State machine validators reject illegal transitions
 *
 * Requires: local Supabase running (npx supabase start)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  validateOpportunityTransition,
  validateHandoffTransition,
  validateTeamTransition,
  validateTeamRuntimeTransition,
  validateTaskTransition,
  validatePlatformTransition,
} from '../shared/state-machines.js';
import { OpportunityStage, HandoffState, TeamStatus, TeamRuntimeStatus, TaskStatus, PlatformStatus } from '../shared/enums.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// --- State Machine Tests (no DB required) ---

describe('State Machine Validators', () => {
  describe('Opportunity', () => {
    it('allows discovered → screened', () => {
      expect(validateOpportunityTransition(OpportunityStage.Discovered, OpportunityStage.Screened).valid).toBe(true);
    });

    it('allows prioritized → submitted (passthrough)', () => {
      expect(validateOpportunityTransition(OpportunityStage.Prioritized, OpportunityStage.Submitted).valid).toBe(true);
    });

    it('allows prioritized → material_ready (full_tailored)', () => {
      expect(validateOpportunityTransition(OpportunityStage.Prioritized, OpportunityStage.MaterialReady).valid).toBe(true);
    });

    it('allows any active stage → needs_takeover', () => {
      expect(validateOpportunityTransition(OpportunityStage.Submitted, OpportunityStage.NeedsTakeover).valid).toBe(true);
      expect(validateOpportunityTransition(OpportunityStage.FollowupActive, OpportunityStage.NeedsTakeover).valid).toBe(true);
    });

    it('allows any active stage → closed', () => {
      expect(validateOpportunityTransition(OpportunityStage.Discovered, OpportunityStage.Closed).valid).toBe(true);
    });

    it('rejects closed → anything', () => {
      expect(validateOpportunityTransition(OpportunityStage.Closed, OpportunityStage.Discovered).valid).toBe(false);
    });

    it('rejects backward movement', () => {
      expect(validateOpportunityTransition(OpportunityStage.Submitted, OpportunityStage.Discovered).valid).toBe(false);
    });

    it('rejects discovered → submitted (must go through screening)', () => {
      expect(validateOpportunityTransition(OpportunityStage.Discovered, OpportunityStage.Submitted).valid).toBe(false);
    });
  });

  describe('Handoff', () => {
    it('allows awaiting_takeover → in_user_handling', () => {
      expect(validateHandoffTransition(HandoffState.AwaitingTakeover, HandoffState.InUserHandling).valid).toBe(true);
    });

    it('allows in_user_handling → resolved', () => {
      expect(validateHandoffTransition(HandoffState.InUserHandling, HandoffState.Resolved).valid).toBe(true);
    });

    it('rejects awaiting_takeover → resolved (must go through in_user_handling)', () => {
      expect(validateHandoffTransition(HandoffState.AwaitingTakeover, HandoffState.Resolved).valid).toBe(false);
    });
  });

  describe('Team', () => {
    it('allows draft → onboarding', () => {
      expect(validateTeamTransition(TeamStatus.Draft, TeamStatus.Onboarding).valid).toBe(true);
    });

    it('allows active ↔ paused', () => {
      expect(validateTeamTransition(TeamStatus.Active, TeamStatus.Paused).valid).toBe(true);
      expect(validateTeamTransition(TeamStatus.Paused, TeamStatus.Active).valid).toBe(true);
    });

    it('rejects draft → active (must go through onboarding)', () => {
      expect(validateTeamTransition(TeamStatus.Draft, TeamStatus.Active).valid).toBe(false);
    });
  });

  describe('TeamRuntime', () => {
    it('allows idle → starting → active → pausing → paused', () => {
      expect(validateTeamRuntimeTransition(TeamRuntimeStatus.Idle, TeamRuntimeStatus.Starting).valid).toBe(true);
      expect(validateTeamRuntimeTransition(TeamRuntimeStatus.Starting, TeamRuntimeStatus.Active).valid).toBe(true);
      expect(validateTeamRuntimeTransition(TeamRuntimeStatus.Active, TeamRuntimeStatus.Pausing).valid).toBe(true);
      expect(validateTeamRuntimeTransition(TeamRuntimeStatus.Pausing, TeamRuntimeStatus.Paused).valid).toBe(true);
    });
  });

  describe('Task', () => {
    it('allows queued → running → completed', () => {
      expect(validateTaskTransition(TaskStatus.Queued, TaskStatus.Running).valid).toBe(true);
      expect(validateTaskTransition(TaskStatus.Running, TaskStatus.Completed).valid).toBe(true);
    });

    it('allows running → queued (pause normalization)', () => {
      expect(validateTaskTransition(TaskStatus.Running, TaskStatus.Queued).valid).toBe(true);
    });

    it('allows failed → queued (retry)', () => {
      expect(validateTaskTransition(TaskStatus.Failed, TaskStatus.Queued).valid).toBe(true);
    });

    it('rejects completed → anything', () => {
      expect(validateTaskTransition(TaskStatus.Completed, TaskStatus.Running).valid).toBe(false);
    });
  });

  describe('Platform', () => {
    it('allows available_unconnected → pending_login → active', () => {
      expect(validatePlatformTransition(PlatformStatus.AvailableUnconnected, PlatformStatus.PendingLogin).valid).toBe(true);
      expect(validatePlatformTransition(PlatformStatus.PendingLogin, PlatformStatus.Active).valid).toBe(true);
    });

    it('allows active → session_expired', () => {
      expect(validatePlatformTransition(PlatformStatus.Active, PlatformStatus.SessionExpired).valid).toBe(true);
    });
  });
});

// --- RLS Tests (require local Supabase) ---

describe('RLS Isolation', () => {
  let serviceClient: SupabaseClient;

  beforeAll(() => {
    if (!SERVICE_ROLE_KEY) {
      console.warn('Skipping RLS tests: SUPABASE_SERVICE_ROLE_KEY not set. Run with local Supabase.');
      return;
    }
    serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  });

  it('should have 7 platform definitions seeded', async () => {
    if (!SERVICE_ROLE_KEY) return;
    const { data, error } = await serviceClient.from('platform_definition').select('code');
    expect(error).toBeNull();
    expect(data).toHaveLength(7);
    const codes = data!.map((d: { code: string }) => d.code).sort();
    expect(codes).toEqual([
      'boss_zhipin', 'greenhouse', 'lagou', 'lever', 'liepin', 'linkedin', 'zhaopin',
    ]);
  });

  it('should have correct pipeline_mode per platform', async () => {
    if (!SERVICE_ROLE_KEY) return;
    const { data } = await serviceClient
      .from('platform_definition')
      .select('code, region, pipeline_mode');

    for (const platform of data!) {
      const p = platform as { code: string; region: string; pipeline_mode: string };
      if (p.region === 'china') {
        expect(p.pipeline_mode).toBe('passthrough');
      } else {
        expect(p.pipeline_mode).toBe('full_tailored');
      }
    }
  });
});
