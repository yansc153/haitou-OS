-- M0: AgentTask, TimelineEvent, and Junction Tables

CREATE TABLE agent_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  agent_instance_id uuid NOT NULL REFERENCES agent_instance(id),
  task_type text NOT NULL,
  task_loop task_loop NOT NULL,
  status task_status NOT NULL DEFAULT 'queued',
  idempotency_key text UNIQUE,
  priority priority NOT NULL DEFAULT 'medium',
  related_entity_type text,
  related_entity_id uuid,
  trigger_source text NOT NULL DEFAULT 'orchestrator',
  upstream_task_id uuid REFERENCES agent_task(id),
  input_summary text,
  output_summary text,
  boundary_flags jsonb DEFAULT '[]'::jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_retry_at timestamptz,
  fallback_used boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  blocked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from submission_attempt to agent_task now that agent_task exists
ALTER TABLE submission_attempt
  ADD CONSTRAINT fk_submission_agent_task FOREIGN KEY (agent_task_id) REFERENCES agent_task(id);

CREATE TABLE agent_task_dependency (
  task_id uuid NOT NULL REFERENCES agent_task(id),
  depends_on_task_id uuid NOT NULL REFERENCES agent_task(id),
  PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE TABLE timeline_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  event_type text NOT NULL,
  summary_text text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  actor_name text,
  actor_role_title text,
  related_entity_type text,
  related_entity_id uuid,
  handoff_to_actor_id uuid,
  handoff_to_actor_name text,
  visibility timeline_visibility NOT NULL DEFAULT 'feed',
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE submission_attempt_material (
  submission_attempt_id uuid NOT NULL REFERENCES submission_attempt(id),
  material_id uuid NOT NULL REFERENCES material(id),
  PRIMARY KEY (submission_attempt_id, material_id)
);

CREATE TABLE handoff_material (
  handoff_id uuid NOT NULL REFERENCES handoff(id),
  material_id uuid NOT NULL REFERENCES material(id),
  PRIMARY KEY (handoff_id, material_id)
);
