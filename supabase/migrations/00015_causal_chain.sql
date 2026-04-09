-- Causal Chain Support
-- timeline_event: add target_agent for group-chat style dispatch events
-- user_preferences: add preferred_locations for city filtering in discovery

ALTER TABLE timeline_event
  ADD COLUMN IF NOT EXISTS target_agent text DEFAULT NULL;

COMMENT ON COLUMN timeline_event.target_agent IS 'Agent being addressed in dispatch_assign events (e.g., 履历分析师)';

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS preferred_locations text DEFAULT NULL;

COMMENT ON COLUMN user_preferences.preferred_locations IS 'Comma-separated target cities from onboarding (e.g., shanghai,beijing)';
