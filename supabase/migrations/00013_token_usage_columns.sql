-- Add token usage tracking columns to team table
-- These are atomically incremented by the Worker after each AI skill call.
-- Source: V1_ISSUE_TRACKER Issue #7

ALTER TABLE team ADD COLUMN IF NOT EXISTS total_input_tokens bigint NOT NULL DEFAULT 0;
ALTER TABLE team ADD COLUMN IF NOT EXISTS total_output_tokens bigint NOT NULL DEFAULT 0;
ALTER TABLE team ADD COLUMN IF NOT EXISTS total_llm_calls integer NOT NULL DEFAULT 0;

-- Atomic increment function — avoids read-then-write race conditions in the Worker
CREATE OR REPLACE FUNCTION increment_token_usage(
  p_team_id uuid,
  p_input bigint,
  p_output bigint
) RETURNS void AS $$
BEGIN
  UPDATE team
  SET total_input_tokens = total_input_tokens + p_input,
      total_output_tokens = total_output_tokens + p_output,
      total_llm_calls = total_llm_calls + 1,
      updated_at = now()
  WHERE id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
