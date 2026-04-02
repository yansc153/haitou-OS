/**
 * Orchestration Worker — Entry Point
 * Deploys on Fly.io as a long-running process.
 * Connects to Supabase DB directly via service role.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 2: Orchestration Engine
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DispatchLoop } from './dispatch-loop.js';
import { BillingService } from './services/billing.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const billing = new BillingService(supabase);
const dispatcher = new DispatchLoop(supabase, billing);

async function main() {
  console.log('[worker] Orchestration worker starting...');

  // Verify DB connection
  const { error } = await supabase.from('platform_definition').select('id').limit(1);
  if (error) {
    console.error('[worker] Failed to connect to database:', error.message);
    process.exit(1);
  }
  console.log('[worker] Database connection verified.');

  // Start dispatch loop
  dispatcher.start();

  console.log('[worker] Orchestration worker running.');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received, shutting down...');
  dispatcher.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[worker] SIGINT received, shutting down...');
  dispatcher.stop();
  process.exit(0);
});

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
