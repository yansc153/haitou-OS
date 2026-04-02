-- M0: Indexes
-- Source: DATA_MODEL_SPEC.md § Recommended Indexes

-- Opportunity
CREATE INDEX idx_opportunity_team_stage ON opportunity(team_id, stage);
CREATE INDEX idx_opportunity_team_created ON opportunity(team_id, created_at);
CREATE INDEX idx_opportunity_team_platform ON opportunity(team_id, source_platform_id);
CREATE INDEX idx_opportunity_canonical_group ON opportunity(canonical_group_id) WHERE canonical_group_id IS NOT NULL;

-- Handoff
CREATE INDEX idx_handoff_team_state ON handoff(team_id, state);
CREATE INDEX idx_handoff_team_opportunity ON handoff(team_id, opportunity_id);

-- SubmissionAttempt
CREATE INDEX idx_submission_team_opportunity ON submission_attempt(team_id, opportunity_id);
CREATE INDEX idx_submission_team_created ON submission_attempt(team_id, created_at);

-- Material
CREATE INDEX idx_material_team_opportunity ON material(team_id, opportunity_id);
CREATE INDEX idx_material_team_type ON material(team_id, material_type);

-- ConversationThread
CREATE INDEX idx_thread_team_opportunity ON conversation_thread(team_id, opportunity_id);

-- ConversationMessage
CREATE INDEX idx_message_thread_sent ON conversation_message(thread_id, sent_at);

-- AgentTask
CREATE INDEX idx_task_team_agent_status ON agent_task(team_id, agent_instance_id, status);
CREATE INDEX idx_task_team_status ON agent_task(team_id, status);

-- TimelineEvent
CREATE INDEX idx_timeline_team_visibility_occurred ON timeline_event(team_id, visibility, occurred_at);
CREATE INDEX idx_timeline_team_entity ON timeline_event(team_id, related_entity_id);

-- PlatformConnection
CREATE INDEX idx_platform_conn_team_platform ON platform_connection(team_id, platform_id);
CREATE INDEX idx_platform_conn_capability ON platform_connection USING gin(capability_status);

-- RuntimeLedgerEntry
CREATE INDEX idx_ledger_team_created ON runtime_ledger_entry(team_id, created_at DESC);

-- AgentStateTransition
CREATE INDEX idx_agent_transition_instance ON agent_state_transition(agent_instance_id, created_at);

-- ProfileBaseline
CREATE INDEX idx_profile_team_version ON profile_baseline(team_id, version DESC);
