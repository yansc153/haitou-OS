/**
 * Orchestration Worker — Entry Point
 * Deploys on Fly.io as a long-running process.
 * Connects to Supabase DB directly via service role.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 2: Orchestration Engine
 */

import { createServer } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DispatchLoop } from './dispatch-loop.js';
import { BillingService } from './services/billing.js';
import { closeBrowser } from './utils/browser-pool.js';

// Validate required env vars at startup
const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHSCOPE_API_KEY', 'VAULT_ENCRYPTION_KEY'] as const;
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`[worker] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '8080', 10);

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const billing = new BillingService(supabase);
const dispatcher = new DispatchLoop(supabase, billing);

const startedAt = Date.now();
let server: ReturnType<typeof createServer>;

async function main() {
  console.log('[worker] Orchestration worker starting...');

  // Verify DB connection
  const { error } = await supabase.from('platform_definition').select('id').limit(1);
  if (error) {
    console.error('[worker] Failed to connect to database:', error.message);
    process.exit(1);
  }
  console.log('[worker] Database connection verified.');

  // Start health check HTTP server (Fly.io needs this)
  server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        started_at: new Date(startedAt).toISOString(),
        dispatching: dispatcher.isRunning(),
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(HEALTH_PORT, () => {
    console.log(`[worker] Health check listening on :${HEALTH_PORT}`);
  });

  // Clean up stale running tasks from previous process (prevents post-deploy dispatch blocking)
  const { data: staleTasks } = await supabase
    .from('agent_task')
    .select('id, task_type')
    .eq('status', 'running');
  if (staleTasks && staleTasks.length > 0) {
    await supabase.from('agent_task')
      .update({ status: 'queued', error_message: 'Requeued on worker startup' })
      .eq('status', 'running');
    console.log(`[worker] Requeued ${staleTasks.length} stale running tasks from previous process`);
  }

  // Start dispatch loop
  dispatcher.start();

  console.log('[worker] Orchestration worker running.');
}

// Graceful shutdown with drain
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down...`);
  dispatcher.stop();
  await closeBrowser().catch(() => {});
  if (server) {
    server.close(() => process.exit(0));
  }
  // Force exit after 10s if drain doesn't complete
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
