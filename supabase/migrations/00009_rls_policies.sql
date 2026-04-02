-- M0: Row-Level Security Policies
-- Source: DATA_MODEL_SPEC.md § Row-Level Security (Supabase RLS)
-- Ownership chain: auth.uid() = User.id = Team.user_id → *.team_id
--
-- IMPORTANT: Every write policy uses WITH CHECK to prevent users from
-- inserting/updating rows with a team_id/user_id belonging to another user.
-- USING alone only controls row visibility for SELECT/UPDATE/DELETE but does
-- NOT validate new row values on INSERT or the post-update row on UPDATE.

-- Enable RLS on all tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE team ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state_transition ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity ENABLE ROW LEVEL SECURITY;
ALTER TABLE material ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_ledger_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_dependency ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attempt_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_material ENABLE ROW LEVEL SECURITY;

-- User: own row only
CREATE POLICY user_own ON "user"
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Team: own team only
CREATE POLICY team_own ON team
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User-scoped tables (no team_id, use user_id directly)
CREATE POLICY onboarding_own ON onboarding_draft
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY resume_own ON resume_asset
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- PlatformDefinition: read-only for all authenticated users (no WITH CHECK needed for SELECT-only)
CREATE POLICY platform_def_read ON platform_definition
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Team-scoped tables: access through team ownership chain
-- Helper subquery used in both USING and WITH CHECK:
--   team_id IN (SELECT id FROM team WHERE user_id = auth.uid())

CREATE POLICY team_scope ON opportunity
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON handoff
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON agent_instance
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON agent_state_transition
  FOR ALL
  USING (agent_instance_id IN (SELECT id FROM agent_instance WHERE team_id IN (SELECT id FROM team WHERE user_id = auth.uid())))
  WITH CHECK (agent_instance_id IN (SELECT id FROM agent_instance WHERE team_id IN (SELECT id FROM team WHERE user_id = auth.uid())));

CREATE POLICY team_scope ON material
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON conversation_thread
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON conversation_message
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON agent_task
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON timeline_event
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON runtime_ledger_entry
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON submission_attempt
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON platform_connection
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON submission_profile
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON profile_baseline
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON user_preferences
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON platform_consent_log
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

CREATE POLICY team_scope ON platform_daily_usage
  FOR ALL
  USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

-- Junction tables: inherit access through parent entity
CREATE POLICY junction_scope ON submission_attempt_material
  FOR ALL
  USING (submission_attempt_id IN (
    SELECT id FROM submission_attempt WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (submission_attempt_id IN (
    SELECT id FROM submission_attempt WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY junction_scope ON handoff_material
  FOR ALL
  USING (handoff_id IN (
    SELECT id FROM handoff WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (handoff_id IN (
    SELECT id FROM handoff WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY junction_scope ON agent_task_dependency
  FOR ALL
  USING (task_id IN (
    SELECT id FROM agent_task WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (task_id IN (
    SELECT id FROM agent_task WHERE team_id IN (
      SELECT id FROM team WHERE user_id = auth.uid()
    )
  ));
