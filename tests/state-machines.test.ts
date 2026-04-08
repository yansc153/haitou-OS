/**
 * Unit Tests: State Machine Validators
 * Tests all valid and invalid transitions per DATA_MODEL_SPEC.md
 */
import { describe, it, expect } from 'vitest';
import {
  validateOpportunityTransition,
  validateHandoffTransition,
  validateTeamTransition,
} from '../src/shared/state-machines';
import { OpportunityStage, HandoffState, TeamStatus } from '../src/shared/enums';

describe('Opportunity State Machine', () => {
  // Valid forward transitions
  const validTransitions: [OpportunityStage, OpportunityStage][] = [
    [OpportunityStage.Discovered, OpportunityStage.Screened],
    [OpportunityStage.Screened, OpportunityStage.Prioritized],
    [OpportunityStage.Prioritized, OpportunityStage.MaterialReady],
    [OpportunityStage.Prioritized, OpportunityStage.Submitted], // passthrough
    [OpportunityStage.MaterialReady, OpportunityStage.Submitted],
    [OpportunityStage.Submitted, OpportunityStage.ContactStarted],
    [OpportunityStage.ContactStarted, OpportunityStage.FollowupActive],
    [OpportunityStage.FollowupActive, OpportunityStage.PositiveProgression],
    [OpportunityStage.PositiveProgression, OpportunityStage.Closed],
  ];

  validTransitions.forEach(([from, to]) => {
    it(`allows ${from} → ${to}`, () => {
      expect(validateOpportunityTransition(from, to).valid).toBe(true);
    });
  });

  // Any active stage → needs_takeover
  const activeStages = [
    OpportunityStage.Discovered, OpportunityStage.Screened, OpportunityStage.Prioritized,
    OpportunityStage.Submitted, OpportunityStage.ContactStarted,
  ];
  activeStages.forEach(stage => {
    it(`allows ${stage} → needs_takeover`, () => {
      expect(validateOpportunityTransition(stage, OpportunityStage.NeedsTakeover).valid).toBe(true);
    });
    it(`allows ${stage} → closed`, () => {
      expect(validateOpportunityTransition(stage, OpportunityStage.Closed).valid).toBe(true);
    });
  });

  // Invalid transitions
  const invalidTransitions: [OpportunityStage, OpportunityStage][] = [
    [OpportunityStage.Discovered, OpportunityStage.Submitted], // skip screening
    [OpportunityStage.Screened, OpportunityStage.Submitted],   // skip prioritized
    [OpportunityStage.Closed, OpportunityStage.Discovered],    // terminal
    [OpportunityStage.Submitted, OpportunityStage.Discovered], // backwards
  ];

  invalidTransitions.forEach(([from, to]) => {
    it(`blocks ${from} → ${to}`, () => {
      expect(validateOpportunityTransition(from, to).valid).toBe(false);
    });
  });

  it('blocks no-op transition', () => {
    expect(validateOpportunityTransition(OpportunityStage.Discovered, OpportunityStage.Discovered).valid).toBe(false);
  });
});

describe('Handoff State Machine', () => {
  it('allows awaiting_takeover → in_user_handling', () => {
    expect(validateHandoffTransition(HandoffState.AwaitingTakeover, HandoffState.InUserHandling).valid).toBe(true);
  });

  it('allows in_user_handling → resolved', () => {
    expect(validateHandoffTransition(HandoffState.InUserHandling, HandoffState.Resolved).valid).toBe(true);
  });

  it('allows in_user_handling → waiting_external', () => {
    expect(validateHandoffTransition(HandoffState.InUserHandling, HandoffState.WaitingExternal).valid).toBe(true);
  });

  it('blocks awaiting_takeover → resolved (must go through handling)', () => {
    expect(validateHandoffTransition(HandoffState.AwaitingTakeover, HandoffState.Resolved).valid).toBe(false);
  });

  it('blocks resolved → awaiting_takeover (backwards)', () => {
    expect(validateHandoffTransition(HandoffState.Resolved, HandoffState.AwaitingTakeover).valid).toBe(false);
  });
});

describe('Team Status State Machine', () => {
  it('allows ready → active', () => {
    expect(validateTeamTransition(TeamStatus.Ready, TeamStatus.Active).valid).toBe(true);
  });

  it('allows active → paused', () => {
    expect(validateTeamTransition(TeamStatus.Active, TeamStatus.Paused).valid).toBe(true);
  });

  it('allows paused → active (resume)', () => {
    expect(validateTeamTransition(TeamStatus.Paused, TeamStatus.Active).valid).toBe(true);
  });

  it('blocks draft → active (must go through onboarding)', () => {
    expect(validateTeamTransition(TeamStatus.Draft, TeamStatus.Active).valid).toBe(false);
  });

  it('blocks active → draft (backwards)', () => {
    expect(validateTeamTransition(TeamStatus.Active, TeamStatus.Draft).valid).toBe(false);
  });
});
