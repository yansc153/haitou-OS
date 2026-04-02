-- M0: Conversation Entities
-- ConversationThread, ConversationMessage

CREATE TABLE conversation_thread (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  opportunity_id uuid NOT NULL REFERENCES opportunity(id),
  platform_connection_id uuid NOT NULL REFERENCES platform_connection(id),
  platform_thread_id text,
  thread_status conversation_thread_status NOT NULL DEFAULT 'active',
  latest_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES conversation_thread(id),
  team_id uuid NOT NULL REFERENCES team(id),
  platform_message_id text,
  direction conversation_message_direction NOT NULL,
  message_type conversation_message_type NOT NULL,
  content_text text NOT NULL,
  reply_posture reply_posture,
  extracted_signals jsonb DEFAULT '[]'::jsonb,
  asks_or_requests jsonb DEFAULT '[]'::jsonb,
  agent_id uuid REFERENCES agent_instance(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
