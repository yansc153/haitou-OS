-- Enable Supabase Realtime for tables that need live updates
-- Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Realtime Channels

-- Live feed on home page
ALTER PUBLICATION supabase_realtime ADD TABLE timeline_event;

-- Team runtime status changes (pause/resume)
ALTER PUBLICATION supabase_realtime ADD TABLE team;

-- Handoff notifications
ALTER PUBLICATION supabase_realtime ADD TABLE handoff;

-- Opportunity stage changes (for opportunity detail live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE opportunity;
