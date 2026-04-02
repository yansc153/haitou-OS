-- M0: Canonical Enumerations
-- Source: DATA_MODEL_SPEC.md § Canonical Enumerations
-- All enum types used across the system. Single source of truth at DB level.

-- Team & User
CREATE TYPE strategy_mode AS ENUM ('balanced', 'broad', 'precise');
CREATE TYPE coverage_scope AS ENUM ('china', 'global_english', 'cross_market');
CREATE TYPE team_status AS ENUM ('draft', 'onboarding', 'activation_pending', 'ready', 'active', 'paused', 'suspended', 'archived');
CREATE TYPE team_runtime_status AS ENUM ('idle', 'starting', 'active', 'pausing', 'paused', 'attention_required');
CREATE TYPE pause_origin AS ENUM ('user', 'system_entitlement', 'system_safety', 'system_admin');
CREATE TYPE onboarding_status AS ENUM ('resume_required', 'questions_in_progress', 'ready_for_activation', 'completed');
CREATE TYPE resume_upload_status AS ENUM ('missing', 'uploading', 'uploaded', 'processing', 'processed', 'failed');
CREATE TYPE resume_parse_status AS ENUM ('pending', 'processing', 'parsed', 'failed');
CREATE TYPE locale_code AS ENUM ('zh-CN', 'en');
CREATE TYPE work_mode AS ENUM ('remote', 'onsite', 'hybrid', 'flexible', 'other');
CREATE TYPE relocation_willingness AS ENUM ('yes', 'no', 'negotiable');
CREATE TYPE onsite_acceptance AS ENUM ('yes', 'no', 'hybrid_only');
CREATE TYPE submission_profile_completeness AS ENUM ('missing', 'partial', 'minimum_ready', 'complete');
CREATE TYPE execution_readiness_level AS ENUM ('not_ready', 'partially_ready', 'minimum_ready', 'fully_ready');

-- Agent
CREATE TYPE agent_role_code AS ENUM ('orchestrator', 'profile_intelligence', 'materials_advisor', 'opportunity_research', 'matching_review', 'application_executor', 'relationship_manager');
CREATE TYPE agent_lifecycle_state AS ENUM ('created', 'initialized', 'ready', 'activated', 'running', 'paused', 'archived');
CREATE TYPE agent_runtime_state AS ENUM ('sleeping', 'ready', 'active', 'waiting', 'blocked', 'paused', 'handoff', 'completed');
CREATE TYPE health_status AS ENUM ('healthy', 'degraded', 'unstable');

-- Opportunity
CREATE TYPE opportunity_stage AS ENUM ('discovered', 'screened', 'prioritized', 'material_ready', 'submitted', 'contact_started', 'followup_active', 'positive_progression', 'needs_takeover', 'closed');
CREATE TYPE opportunity_closure_reason AS ENUM ('user_declined', 'employer_rejected', 'employer_no_response', 'position_filled', 'position_expired', 'duplicate_collapsed', 'fit_dropped', 'platform_blocked', 'user_resolved_handoff', 'system_expired');
CREATE TYPE recommendation_verdict AS ENUM ('advance', 'watch', 'drop', 'needs_context');
CREATE TYPE fit_posture AS ENUM ('strong', 'moderate', 'weak', 'uncertain');
CREATE TYPE freshness AS ENUM ('new', 'recent', 'stale', 'unknown');
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Handoff
CREATE TYPE handoff_type AS ENUM ('private_contact', 'salary_confirmation', 'interview_time', 'work_arrangement', 'visa_eligibility', 'reference_check', 'offer_decision', 'other_high_risk');
CREATE TYPE handoff_state AS ENUM ('awaiting_takeover', 'in_user_handling', 'waiting_external', 'resolved', 'returned_to_team', 'closed');
CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE handoff_resolution_type AS ENUM ('resolved', 'returned_to_team', 'closed_by_user', 'expired');

-- Material
CREATE TYPE material_type AS ENUM ('source_resume', 'light_edit_resume', 'standard_tailored_resume', 'deep_tailored_resume', 'localized_resume', 'cover_letter', 'first_contact_draft', 'follow_up_draft', 'email_draft', 'reply_draft', 'supporting_text', 'summary_card', 'context_card', 'handoff_package');
CREATE TYPE material_status AS ENUM ('generating', 'ready', 'superseded', 'failed');
CREATE TYPE edit_intensity AS ENUM ('light', 'standard', 'deep');
CREATE TYPE preservation_mode AS ENUM ('strict', 'adaptive', 'content_only_fallback');
CREATE TYPE language_code AS ENUM ('zh', 'en', 'bilingual');

-- Execution
CREATE TYPE execution_outcome AS ENUM ('submitted', 'partially_submitted', 'failed', 'blocked');
CREATE TYPE confidence_band AS ENUM ('high', 'medium', 'low');

-- Conversation
CREATE TYPE conversation_thread_status AS ENUM ('active', 'paused', 'handoff_triggered', 'closed');
CREATE TYPE conversation_message_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE conversation_message_type AS ENUM ('first_contact', 'follow_up', 'reply', 'system_note');
CREATE TYPE reply_posture AS ENUM ('positive', 'neutral', 'unclear', 'handoff_trigger');

-- Platform
CREATE TYPE platform_region AS ENUM ('china', 'global_english');
CREATE TYPE pipeline_mode AS ENUM ('full_tailored', 'passthrough');
CREATE TYPE platform_type AS ENUM ('job_board', 'recruiter_network', 'ats_portal', 'email_outreach');
CREATE TYPE platform_status AS ENUM ('active', 'available_unconnected', 'pending_login', 'session_expired', 'restricted', 'unavailable', 'plan_locked');
CREATE TYPE anti_scraping_level AS ENUM ('low', 'medium', 'high', 'extreme');
CREATE TYPE captcha_frequency AS ENUM ('none', 'rare', 'frequent', 'always');
CREATE TYPE platform_capability_name AS ENUM ('search', 'detail', 'apply', 'chat', 'resume');
CREATE TYPE platform_capability_status AS ENUM ('healthy', 'degraded', 'blocked', 'unknown');
CREATE TYPE verification_state AS ENUM ('none', 'captcha_required', 'sms_required', 'manual_required');
CREATE TYPE consent_scope AS ENUM ('apply_and_message', 'apply_only', 'read_only');
CREATE TYPE consent_action AS ENUM ('granted', 'renewed', 'rotated', 'revoked', 'expired');
CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'plus');

-- Task
CREATE TYPE task_status AS ENUM ('queued', 'running', 'waiting_dependency', 'blocked', 'completed', 'failed', 'cancelled');
CREATE TYPE task_loop AS ENUM ('opportunity_generation', 'opportunity_progression');

-- Timeline
CREATE TYPE timeline_visibility AS ENUM ('feed', 'opportunity_timeline', 'internal', 'audit');

-- Billing
CREATE TYPE runtime_ledger_entry_type AS ENUM ('session_start', 'session_end', 'allocation', 'adjustment', 'expiry');

-- Language
CREATE TYPE language_proficiency AS ENUM ('native', 'fluent', 'professional', 'conversational', 'basic');
