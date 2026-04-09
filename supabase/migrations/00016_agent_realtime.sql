-- Enable realtime for agent_instance so frontend can stream status changes
ALTER PUBLICATION supabase_realtime ADD TABLE agent_instance;
