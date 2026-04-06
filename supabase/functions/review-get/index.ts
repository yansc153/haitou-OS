import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /review-get → ReviewPayload
 * Aggregates opportunity counts, stage distributions, and performance signals.
 *
 * Query params: window?=7d|14d|30d (default: 7d)
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § GET /api/ui/review
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('id, name, status, runtime_status, strategy_mode, coverage_scope, started_at')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  // Parse window param
  const url = new URL(req.url);
  const windowParam = url.searchParams.get('window') || '7d';
  const windowDays = windowParam === '30d' ? 30 : windowParam === '14d' ? 14 : 7;
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60_000).toISOString();
  const windowLabels: Record<string, string> = { '7d': '过去 7 天', '14d': '过去 14 天', '30d': '过去 30 天' };

  // Parallel queries for the review window
  const [oppRes, submittedRes, handoffRes, taskRes, runtimeRes] = await Promise.all([
    // Opportunity counts by stage (within window)
    supabase!
      .from('opportunity')
      .select('id, stage, source_platform_id')
      .eq('team_id', team.id)
      .gte('created_at', windowStart),

    // Submitted opportunities (outcomes)
    supabase!
      .from('submission_attempt')
      .select('id, execution_outcome')
      .eq('team_id', team.id)
      .gte('created_at', windowStart),

    // Handoffs created
    supabase!
      .from('handoff')
      .select('id, state, handoff_type')
      .eq('team_id', team.id)
      .gte('created_at', windowStart),

    // Agent task completions
    supabase!
      .from('agent_task')
      .select('id, task_type, status')
      .eq('team_id', team.id)
      .gte('created_at', windowStart),

    // Runtime ledger for balance
    supabase!
      .from('runtime_ledger_entry')
      .select('balance_after_seconds')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const opportunities = oppRes.data || [];
  const submissions = submittedRes.data || [];
  const handoffs = handoffRes.data || [];
  const tasks = taskRes.data || [];

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  for (const opp of opportunities) {
    stageCounts[opp.stage] = (stageCounts[opp.stage] || 0) + 1;
  }

  // Submission outcomes
  const submitSuccess = submissions.filter(s => s.execution_outcome === 'submitted').length;
  const submitFailed = submissions.filter(s => s.execution_outcome === 'failed').length;

  // Task stats
  const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
  const tasksFailed = tasks.filter(t => t.status === 'failed').length;

  // Build key outcomes
  const keyOutcomes = [
    { label: '发现岗位', value: String(opportunities.length) },
    { label: '成功投递', value: String(submitSuccess) },
    { label: '投递失败', value: String(submitFailed) },
    { label: '需要接管', value: String(handoffs.length) },
    { label: '任务完成', value: String(tasksCompleted) },
    { label: '任务失败', value: String(tasksFailed) },
  ];

  // Build suggestions
  const suggestions: string[] = [];
  if (submitFailed > submitSuccess && submitFailed > 0) {
    suggestions.push('投递失败率偏高，请检查平台连接状态和简历格式');
  }
  if (opportunities.length === 0) {
    suggestions.push('本周期无新岗位发现，考虑扩大搜索关键词或连接更多平台');
  }
  if (handoffs.filter(h => h.state === 'awaiting_takeover').length > 0) {
    suggestions.push('有待处理的交接事��，请及时查看交接中心');
  }
  if (tasksCompleted === 0 && tasksFailed === 0) {
    suggestions.push('本周期无任务执行记录，请确认团队已启动');
  }

  const balance = runtimeRes.data?.[0]?.balance_after_seconds ?? 0;

  const summaryText = `${windowLabels[windowParam]}共发现 ${opportunities.length} 个岗位，成功投递 ${submitSuccess} 个，产生 ${handoffs.length} 个交接事项。`;

  return ok({
    team: {
      id: team.id,
      name: team.name,
      status: team.status,
      runtime_status: team.runtime_status,
      strategy_mode: team.strategy_mode,
      coverage_scope: team.coverage_scope,
    },
    runtime: {
      runtime_status: team.runtime_status,
      balance_seconds: balance,
      started_at: team.started_at,
    },
    review_window_label: windowLabels[windowParam],
    summary_text: summaryText,
    key_outcomes: keyOutcomes,
    stage_distribution: stageCounts,
    suggestions,
  });
});
