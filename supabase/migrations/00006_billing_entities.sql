-- M0: Billing Entities
-- RuntimeLedgerEntry

CREATE TABLE runtime_ledger_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  entry_type runtime_ledger_entry_type NOT NULL,
  runtime_delta_seconds integer NOT NULL DEFAULT 0,
  balance_after_seconds integer NOT NULL DEFAULT 0,
  trigger_source text NOT NULL DEFAULT 'system',
  reason text,
  session_window_start timestamptz,
  session_window_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
