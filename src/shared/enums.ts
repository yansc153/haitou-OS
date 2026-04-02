/**
 * Canonical Enumerations — Single Source of Truth
 * Source: DATA_MODEL_SPEC.md § Canonical Enumerations
 *
 * All enum values in application code MUST be imported from this file.
 * No inline string literals for enum values in business logic.
 */

// --- Team & User ---

export const StrategyMode = {
  Balanced: 'balanced',
  Broad: 'broad',
  Precise: 'precise',
} as const;
export type StrategyMode = (typeof StrategyMode)[keyof typeof StrategyMode];

export const CoverageScope = {
  China: 'china',
  GlobalEnglish: 'global_english',
  CrossMarket: 'cross_market',
} as const;
export type CoverageScope = (typeof CoverageScope)[keyof typeof CoverageScope];

export const TeamStatus = {
  Draft: 'draft',
  Onboarding: 'onboarding',
  ActivationPending: 'activation_pending',
  Ready: 'ready',
  Active: 'active',
  Paused: 'paused',
  Suspended: 'suspended',
  Archived: 'archived',
} as const;
export type TeamStatus = (typeof TeamStatus)[keyof typeof TeamStatus];

export const TeamRuntimeStatus = {
  Idle: 'idle',
  Starting: 'starting',
  Active: 'active',
  Pausing: 'pausing',
  Paused: 'paused',
  AttentionRequired: 'attention_required',
} as const;
export type TeamRuntimeStatus = (typeof TeamRuntimeStatus)[keyof typeof TeamRuntimeStatus];

export const PauseOrigin = {
  User: 'user',
  SystemEntitlement: 'system_entitlement',
  SystemSafety: 'system_safety',
  SystemAdmin: 'system_admin',
} as const;
export type PauseOrigin = (typeof PauseOrigin)[keyof typeof PauseOrigin];

export const PlanTier = {
  Free: 'free',
  Pro: 'pro',
  Plus: 'plus',
} as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

export const ExecutionReadinessLevel = {
  NotReady: 'not_ready',
  PartiallyReady: 'partially_ready',
  MinimumReady: 'minimum_ready',
  FullyReady: 'fully_ready',
} as const;
export type ExecutionReadinessLevel = (typeof ExecutionReadinessLevel)[keyof typeof ExecutionReadinessLevel];

// --- Onboarding ---

export const OnboardingStatus = {
  ResumeRequired: 'resume_required',
  QuestionsInProgress: 'questions_in_progress',
  ReadyForActivation: 'ready_for_activation',
  Completed: 'completed',
} as const;
export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export const ResumeUploadStatus = {
  Missing: 'missing',
  Uploading: 'uploading',
  Uploaded: 'uploaded',
  Processing: 'processing',
  Processed: 'processed',
  Failed: 'failed',
} as const;
export type ResumeUploadStatus = (typeof ResumeUploadStatus)[keyof typeof ResumeUploadStatus];

export const ResumeParseStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Parsed: 'parsed',
  Failed: 'failed',
} as const;
export type ResumeParseStatus = (typeof ResumeParseStatus)[keyof typeof ResumeParseStatus];

export const SubmissionProfileCompleteness = {
  Missing: 'missing',
  Partial: 'partial',
  MinimumReady: 'minimum_ready',
  Complete: 'complete',
} as const;
export type SubmissionProfileCompleteness = (typeof SubmissionProfileCompleteness)[keyof typeof SubmissionProfileCompleteness];

// --- Agent ---

export const AgentRoleCode = {
  Orchestrator: 'orchestrator',
  ProfileIntelligence: 'profile_intelligence',
  MaterialsAdvisor: 'materials_advisor',
  OpportunityResearch: 'opportunity_research',
  MatchingReview: 'matching_review',
  ApplicationExecutor: 'application_executor',
  RelationshipManager: 'relationship_manager',
} as const;
export type AgentRoleCode = (typeof AgentRoleCode)[keyof typeof AgentRoleCode];

export const AgentLifecycleState = {
  Created: 'created',
  Initialized: 'initialized',
  Ready: 'ready',
  Activated: 'activated',
  Running: 'running',
  Paused: 'paused',
  Archived: 'archived',
} as const;
export type AgentLifecycleState = (typeof AgentLifecycleState)[keyof typeof AgentLifecycleState];

export const AgentRuntimeState = {
  Sleeping: 'sleeping',
  Ready: 'ready',
  Active: 'active',
  Waiting: 'waiting',
  Blocked: 'blocked',
  Paused: 'paused',
  Handoff: 'handoff',
  Completed: 'completed',
} as const;
export type AgentRuntimeState = (typeof AgentRuntimeState)[keyof typeof AgentRuntimeState];

export const HealthStatus = {
  Healthy: 'healthy',
  Degraded: 'degraded',
  Unstable: 'unstable',
} as const;
export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

// --- Opportunity ---

export const OpportunityStage = {
  Discovered: 'discovered',
  Screened: 'screened',
  Prioritized: 'prioritized',
  MaterialReady: 'material_ready',
  Submitted: 'submitted',
  ContactStarted: 'contact_started',
  FollowupActive: 'followup_active',
  PositiveProgression: 'positive_progression',
  NeedsTakeover: 'needs_takeover',
  Closed: 'closed',
} as const;
export type OpportunityStage = (typeof OpportunityStage)[keyof typeof OpportunityStage];

export const OpportunityClosureReason = {
  UserDeclined: 'user_declined',
  EmployerRejected: 'employer_rejected',
  EmployerNoResponse: 'employer_no_response',
  PositionFilled: 'position_filled',
  PositionExpired: 'position_expired',
  DuplicateCollapsed: 'duplicate_collapsed',
  FitDropped: 'fit_dropped',
  PlatformBlocked: 'platform_blocked',
  UserResolvedHandoff: 'user_resolved_handoff',
  SystemExpired: 'system_expired',
} as const;
export type OpportunityClosureReason = (typeof OpportunityClosureReason)[keyof typeof OpportunityClosureReason];

export const RecommendationVerdict = {
  Advance: 'advance',
  Watch: 'watch',
  Drop: 'drop',
  NeedsContext: 'needs_context',
} as const;
export type RecommendationVerdict = (typeof RecommendationVerdict)[keyof typeof RecommendationVerdict];

export const FitPosture = {
  Strong: 'strong',
  Moderate: 'moderate',
  Weak: 'weak',
  Uncertain: 'uncertain',
} as const;
export type FitPosture = (typeof FitPosture)[keyof typeof FitPosture];

export const Priority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const Freshness = {
  New: 'new',
  Recent: 'recent',
  Stale: 'stale',
  Unknown: 'unknown',
} as const;
export type Freshness = (typeof Freshness)[keyof typeof Freshness];

// --- Handoff ---

export const HandoffType = {
  PrivateContact: 'private_contact',
  SalaryConfirmation: 'salary_confirmation',
  InterviewTime: 'interview_time',
  WorkArrangement: 'work_arrangement',
  VisaEligibility: 'visa_eligibility',
  ReferenceCheck: 'reference_check',
  OfferDecision: 'offer_decision',
  OtherHighRisk: 'other_high_risk',
} as const;
export type HandoffType = (typeof HandoffType)[keyof typeof HandoffType];

export const HandoffState = {
  AwaitingTakeover: 'awaiting_takeover',
  InUserHandling: 'in_user_handling',
  WaitingExternal: 'waiting_external',
  Resolved: 'resolved',
  ReturnedToTeam: 'returned_to_team',
  Closed: 'closed',
} as const;
export type HandoffState = (typeof HandoffState)[keyof typeof HandoffState];

export const Urgency = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

export const HandoffResolutionType = {
  Resolved: 'resolved',
  ReturnedToTeam: 'returned_to_team',
  ClosedByUser: 'closed_by_user',
  Expired: 'expired',
} as const;
export type HandoffResolutionType = (typeof HandoffResolutionType)[keyof typeof HandoffResolutionType];

// --- Material ---

export const MaterialType = {
  SourceResume: 'source_resume',
  LightEditResume: 'light_edit_resume',
  StandardTailoredResume: 'standard_tailored_resume',
  DeepTailoredResume: 'deep_tailored_resume',
  LocalizedResume: 'localized_resume',
  CoverLetter: 'cover_letter',
  FirstContactDraft: 'first_contact_draft',
  FollowUpDraft: 'follow_up_draft',
  EmailDraft: 'email_draft',
  ReplyDraft: 'reply_draft',
  SupportingText: 'supporting_text',
  SummaryCard: 'summary_card',
  ContextCard: 'context_card',
  HandoffPackage: 'handoff_package',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const MaterialStatus = {
  Generating: 'generating',
  Ready: 'ready',
  Superseded: 'superseded',
  Failed: 'failed',
} as const;
export type MaterialStatus = (typeof MaterialStatus)[keyof typeof MaterialStatus];

// --- Platform ---

export const PlatformRegion = {
  China: 'china',
  GlobalEnglish: 'global_english',
} as const;
export type PlatformRegion = (typeof PlatformRegion)[keyof typeof PlatformRegion];

export const PipelineMode = {
  FullTailored: 'full_tailored',
  Passthrough: 'passthrough',
} as const;
export type PipelineMode = (typeof PipelineMode)[keyof typeof PipelineMode];

export const PlatformStatus = {
  Active: 'active',
  AvailableUnconnected: 'available_unconnected',
  PendingLogin: 'pending_login',
  SessionExpired: 'session_expired',
  Restricted: 'restricted',
  Unavailable: 'unavailable',
  PlanLocked: 'plan_locked',
} as const;
export type PlatformStatus = (typeof PlatformStatus)[keyof typeof PlatformStatus];

export const PlatformCapabilityStatus = {
  Healthy: 'healthy',
  Degraded: 'degraded',
  Blocked: 'blocked',
  Unknown: 'unknown',
} as const;
export type PlatformCapabilityStatus = (typeof PlatformCapabilityStatus)[keyof typeof PlatformCapabilityStatus];

// --- Task ---

export const TaskStatus = {
  Queued: 'queued',
  Running: 'running',
  WaitingDependency: 'waiting_dependency',
  Blocked: 'blocked',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskLoop = {
  OpportunityGeneration: 'opportunity_generation',
  OpportunityProgression: 'opportunity_progression',
} as const;
export type TaskLoop = (typeof TaskLoop)[keyof typeof TaskLoop];

// --- Execution ---

export const ExecutionOutcome = {
  Submitted: 'submitted',
  PartiallySubmitted: 'partially_submitted',
  Failed: 'failed',
  Blocked: 'blocked',
} as const;
export type ExecutionOutcome = (typeof ExecutionOutcome)[keyof typeof ExecutionOutcome];

export const ConfidenceBand = {
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type ConfidenceBand = (typeof ConfidenceBand)[keyof typeof ConfidenceBand];

// --- Conversation ---

export const ConversationThreadStatus = {
  Active: 'active',
  Paused: 'paused',
  HandoffTriggered: 'handoff_triggered',
  Closed: 'closed',
} as const;
export type ConversationThreadStatus = (typeof ConversationThreadStatus)[keyof typeof ConversationThreadStatus];

export const ReplyPosture = {
  Positive: 'positive',
  Neutral: 'neutral',
  Unclear: 'unclear',
  HandoffTrigger: 'handoff_trigger',
} as const;
export type ReplyPosture = (typeof ReplyPosture)[keyof typeof ReplyPosture];

// --- Timeline ---

export const TimelineVisibility = {
  Feed: 'feed',
  OpportunityTimeline: 'opportunity_timeline',
  Internal: 'internal',
  Audit: 'audit',
} as const;
export type TimelineVisibility = (typeof TimelineVisibility)[keyof typeof TimelineVisibility];

// --- Billing ---

export const RuntimeLedgerEntryType = {
  SessionStart: 'session_start',
  SessionEnd: 'session_end',
  Allocation: 'allocation',
  Adjustment: 'adjustment',
  Expiry: 'expiry',
} as const;
export type RuntimeLedgerEntryType = (typeof RuntimeLedgerEntryType)[keyof typeof RuntimeLedgerEntryType];
