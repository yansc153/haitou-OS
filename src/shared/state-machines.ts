/**
 * State Machine Validators — Single Source of Truth
 * Source: DATA_MODEL_SPEC.md § State Machines
 *
 * Every state transition must go through validateTransition().
 * Invalid transitions throw a typed error, never silently succeed.
 */

import {
  OpportunityStage,
  HandoffState,
  TeamStatus,
  TeamRuntimeStatus,
  TaskStatus,
  PlatformStatus,
} from './enums.js';

type TransitionResult = { valid: true } | { valid: false; error: string };

function makeValidator<T extends string>(
  name: string,
  transitions: Record<string, T[]>,
  wildcardTargets?: T[]
): (current: T, target: T) => TransitionResult {
  return (current: T, target: T): TransitionResult => {
    if (current === target) {
      return { valid: false, error: `${name}: no-op transition from ${current} to ${current}` };
    }

    // Check wildcard transitions (e.g., any active stage → closed)
    if (wildcardTargets?.includes(target)) {
      return { valid: true };
    }

    const allowed = transitions[current];
    if (!allowed) {
      return { valid: false, error: `${name}: no transitions defined from ${current}` };
    }
    if (!allowed.includes(target)) {
      return {
        valid: false,
        error: `${name}: illegal transition from ${current} to ${target}. Allowed: ${allowed.join(', ')}`,
      };
    }
    return { valid: true };
  };
}

// --- Opportunity Stage ---

const OPPORTUNITY_ACTIVE_STAGES: OpportunityStage[] = [
  OpportunityStage.Discovered,
  OpportunityStage.Screened,
  OpportunityStage.Prioritized,
  OpportunityStage.MaterialReady,
  OpportunityStage.Submitted,
  OpportunityStage.ContactStarted,
  OpportunityStage.FollowupActive,
  OpportunityStage.PositiveProgression,
];

const opportunityTransitions: Record<string, OpportunityStage[]> = {
  [OpportunityStage.Discovered]: [OpportunityStage.Screened],
  [OpportunityStage.Screened]: [OpportunityStage.Prioritized],
  [OpportunityStage.Prioritized]: [
    OpportunityStage.MaterialReady,  // full_tailored path
    OpportunityStage.Submitted,      // passthrough path
    OpportunityStage.ContactStarted, // chat-first platforms
  ],
  [OpportunityStage.MaterialReady]: [
    OpportunityStage.Submitted,
    OpportunityStage.ContactStarted,
  ],
  [OpportunityStage.Submitted]: [OpportunityStage.ContactStarted],
  [OpportunityStage.ContactStarted]: [OpportunityStage.FollowupActive],
  [OpportunityStage.FollowupActive]: [OpportunityStage.PositiveProgression],
  [OpportunityStage.PositiveProgression]: [OpportunityStage.Closed],
  [OpportunityStage.NeedsTakeover]: [
    OpportunityStage.Closed,
    OpportunityStage.FollowupActive, // returned to team
  ],
  // closed has no outgoing transitions
};

export const validateOpportunityTransition = (
  current: OpportunityStage,
  target: OpportunityStage
): TransitionResult => {
  if (current === OpportunityStage.Closed) {
    return { valid: false, error: 'Opportunity: closed is terminal, no outgoing transitions' };
  }
  // Any active stage → needs_takeover or closed
  if (
    OPPORTUNITY_ACTIVE_STAGES.includes(current) &&
    (target === OpportunityStage.NeedsTakeover || target === OpportunityStage.Closed)
  ) {
    return { valid: true };
  }
  const allowed = opportunityTransitions[current];
  if (!allowed?.includes(target)) {
    return {
      valid: false,
      error: `Opportunity: illegal transition from ${current} to ${target}`,
    };
  }
  return { valid: true };
};

// --- Handoff State ---

export const validateHandoffTransition = makeValidator<HandoffState>('Handoff', {
  [HandoffState.AwaitingTakeover]: [HandoffState.InUserHandling],
  [HandoffState.InUserHandling]: [
    HandoffState.WaitingExternal,
    HandoffState.Resolved,
    HandoffState.ReturnedToTeam,
    HandoffState.Closed,
  ],
  [HandoffState.WaitingExternal]: [
    HandoffState.InUserHandling,
    HandoffState.Resolved,
    HandoffState.Closed,
  ],
  [HandoffState.Resolved]: [HandoffState.Closed],
  [HandoffState.ReturnedToTeam]: [HandoffState.Closed],
});

// --- Team Status ---

export const validateTeamTransition = makeValidator<TeamStatus>('Team', {
  [TeamStatus.Draft]: [TeamStatus.Onboarding],
  [TeamStatus.Onboarding]: [TeamStatus.ActivationPending],
  [TeamStatus.ActivationPending]: [TeamStatus.Ready],
  [TeamStatus.Ready]: [TeamStatus.Active],
  [TeamStatus.Active]: [TeamStatus.Paused, TeamStatus.Suspended, TeamStatus.Archived],
  [TeamStatus.Paused]: [TeamStatus.Active, TeamStatus.Suspended, TeamStatus.Archived],
  [TeamStatus.Suspended]: [TeamStatus.Paused, TeamStatus.Archived],
});

// --- Team Runtime Status ---

export const validateTeamRuntimeTransition = makeValidator<TeamRuntimeStatus>('TeamRuntime', {
  [TeamRuntimeStatus.Idle]: [TeamRuntimeStatus.Starting],
  [TeamRuntimeStatus.Starting]: [TeamRuntimeStatus.Active],
  [TeamRuntimeStatus.Active]: [TeamRuntimeStatus.Pausing, TeamRuntimeStatus.AttentionRequired],
  [TeamRuntimeStatus.Pausing]: [TeamRuntimeStatus.Paused],
  [TeamRuntimeStatus.Paused]: [TeamRuntimeStatus.Starting],
  [TeamRuntimeStatus.AttentionRequired]: [TeamRuntimeStatus.Active, TeamRuntimeStatus.Pausing],
});

// --- Task Status ---

export const validateTaskTransition = makeValidator<TaskStatus>('Task', {
  [TaskStatus.Queued]: [TaskStatus.Running, TaskStatus.Cancelled],
  [TaskStatus.Running]: [
    TaskStatus.WaitingDependency,
    TaskStatus.Blocked,
    TaskStatus.Completed,
    TaskStatus.Failed,
    TaskStatus.Queued,    // team pause normalization only
    TaskStatus.Cancelled,
  ],
  [TaskStatus.WaitingDependency]: [TaskStatus.Running],
  [TaskStatus.Blocked]: [TaskStatus.Queued, TaskStatus.Cancelled],
  [TaskStatus.Failed]: [TaskStatus.Queued], // retry
});

// --- Platform Connection Status ---

export const validatePlatformTransition = makeValidator<PlatformStatus>('Platform', {
  [PlatformStatus.AvailableUnconnected]: [PlatformStatus.PendingLogin],
  [PlatformStatus.PendingLogin]: [PlatformStatus.Active, PlatformStatus.AvailableUnconnected],
  [PlatformStatus.Active]: [PlatformStatus.SessionExpired, PlatformStatus.Restricted],
  [PlatformStatus.SessionExpired]: [PlatformStatus.PendingLogin, PlatformStatus.Restricted],
  [PlatformStatus.Restricted]: [PlatformStatus.PendingLogin],
  [PlatformStatus.PlanLocked]: [PlatformStatus.AvailableUnconnected],
});
