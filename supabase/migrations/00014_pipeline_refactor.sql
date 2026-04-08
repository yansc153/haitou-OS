-- Pipeline Refactor: causal chain support
-- Adds input/output data to agent_task, ability_model to profile_baseline, atomic checkout RPC

-- M1: agent_task input/output data for causal chain
ALTER TABLE agent_task
  ADD COLUMN IF NOT EXISTS input_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS output_data jsonb DEFAULT NULL;

COMMENT ON COLUMN agent_task.input_data IS 'Structured input from upstream task or dispatcher';
COMMENT ON COLUMN agent_task.output_data IS 'Structured output consumed by downstream tasks';

-- M2: profile_baseline ability model (output of analyze_resume task)
ALTER TABLE profile_baseline
  ADD COLUMN IF NOT EXISTS ability_model jsonb DEFAULT NULL;

COMMENT ON COLUMN profile_baseline.ability_model IS 'AI-generated ability model: core_skills, domain_expertise, capability_boundary, seniority_assessment';

-- M3: Atomic checkout RPC — prevents duplicate task execution
CREATE OR REPLACE FUNCTION checkout_task(p_task_id uuid)
RETURNS TABLE(checked_out boolean) AS $$
BEGIN
  UPDATE agent_task
  SET status = 'running', started_at = now()
  WHERE id = p_task_id AND status = 'queued';

  RETURN QUERY SELECT (FOUND)::boolean AS checked_out;
END;
$$ LANGUAGE plpgsql;
