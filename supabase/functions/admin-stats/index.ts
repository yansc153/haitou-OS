import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Auth: must be logged in
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  // Admin check
  const email = (user!.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return err(403, 'FORBIDDEN', 'Not an admin');
  }

  const db = getServiceClient();

  // ── Parallel queries ──
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysIso = sevenDaysAgo.toISOString();

  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  const twentyFourHoursIso = twentyFourHoursAgo.toISOString();

  const [
    // Overview
    usersAllRes,
    usersTodayRes,
    users7dRes,
    teamsAllRes,

    // Platforms
    connectionsRes,
    dailyUsageRes,

    // Funnel
    opportunitiesRes,
    todayDiscoveredRes,
    todaySubmittedRes,
    submissionOutcomesRes,

    // Engine
    tasksQueuedRes,
    tasksRunningRes,
    tasksFailed24hRes,
    tasksCompleted24hRes,
    tasksByTypeRes,

    // Operations
    materialsRes,
    handoffsPendingRes,
    handoffsAllRes,
    resumesRes,
    ledgerRes,

    // Recent events
    recentEventsRes,
  ] = await Promise.all([
    // -- Overview --
    db.auth.admin.listUsers({ page: 1, perPage: 1 }),
    db.from('team').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    db.from('team').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysIso),
    db.from('team').select('id, status, runtime_status, plan_tier, name, user_id, created_at'),

    // -- Platforms --
    db.from('platform_connection').select('platform_id, status, platform_definition:platform_id(name)'),
    db.from('platform_daily_usage').select('platform_id, action_type, action_count, usage_date, platform_definition:platform_id(name)')
      .eq('usage_date', todayIso.slice(0, 10)),

    // -- Funnel --
    db.from('opportunity').select('stage'),
    db.from('opportunity').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    db.from('submission_attempt').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    db.from('submission_attempt').select('outcome'),

    // -- Engine --
    db.from('agent_task').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    db.from('agent_task').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    db.from('agent_task').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', twentyFourHoursIso),
    db.from('agent_task').select('id', { count: 'exact', head: true }).in('status', ['completed', 'succeeded']).gte('updated_at', twentyFourHoursIso),
    db.from('agent_task').select('task_type, status').gte('created_at', twentyFourHoursIso),

    // -- Operations --
    db.from('material').select('id', { count: 'exact', head: true }),
    db.from('handoff').select('id', { count: 'exact', head: true }).eq('state', 'awaiting_takeover'),
    db.from('handoff').select('handoff_type, state'),
    db.from('resume_asset').select('id', { count: 'exact', head: true }),
    db.from('runtime_ledger_entry').select('entry_type, duration_seconds, balance_after_seconds, team_id'),

    // -- Recent events --
    db.from('timeline_event')
      .select('id, event_type, summary_text, occurred_at, team_id, team:team_id(name)')
      .order('occurred_at', { ascending: false })
      .limit(30),
  ]);

  // ── Process results ──

  // Overview
  const totalUsers = usersAllRes.data?.users?.length ?? 0;
  // For total user count, the admin API returns total in the response
  // But with perPage:1 we might not get all. Use a different approach.
  const allTeams = teamsAllRes.data || [];
  const teamsByStatus: Record<string, number> = {};
  let activeTeamsNow = 0;
  for (const t of allTeams) {
    teamsByStatus[t.status] = (teamsByStatus[t.status] || 0) + 1;
    if (t.runtime_status === 'active') activeTeamsNow++;
  }

  // Platforms
  const connections = connectionsRes.data || [];
  const platformMap: Record<string, { total: number; active: number; expired: number; name: string }> = {};
  for (const c of connections) {
    const name = (c.platform_definition as Record<string, string>)?.name || c.platform_id;
    if (!platformMap[name]) platformMap[name] = { total: 0, active: 0, expired: 0, name };
    platformMap[name].total++;
    if (c.status === 'active') platformMap[name].active++;
    if (c.status === 'session_expired') platformMap[name].expired++;
  }

  const dailyUsage = dailyUsageRes.data || [];
  const actionMap: Record<string, { applications: number; messages: number; name: string }> = {};
  for (const u of dailyUsage) {
    const name = (u.platform_definition as Record<string, string>)?.name || u.platform_id;
    if (!actionMap[name]) actionMap[name] = { applications: 0, messages: 0, name };
    if (u.action_type === 'application') actionMap[name].applications += u.action_count || 0;
    if (u.action_type === 'message') actionMap[name].messages += u.action_count || 0;
  }

  // Funnel
  const opps = opportunitiesRes.data || [];
  const byStage: Record<string, number> = {};
  for (const o of opps) {
    byStage[o.stage] = (byStage[o.stage] || 0) + 1;
  }

  const submissions = submissionOutcomesRes.data || [];
  const submissionOutcomes = { success: 0, blocked: 0, error: 0 };
  for (const s of submissions) {
    if (s.outcome === 'success' || s.outcome === 'submitted') submissionOutcomes.success++;
    else if (s.outcome === 'blocked' || s.outcome === 'duplicate') submissionOutcomes.blocked++;
    else submissionOutcomes.error++;
  }

  // Engine
  const taskRows = tasksByTypeRes.data || [];
  const tasksByType: Record<string, number> = {};
  for (const t of taskRows) {
    tasksByType[t.task_type] = (tasksByType[t.task_type] || 0) + 1;
  }

  // Operations
  const allHandoffs = handoffsAllRes.data || [];
  const handoffsByType: Record<string, number> = {};
  for (const h of allHandoffs) {
    handoffsByType[h.handoff_type] = (handoffsByType[h.handoff_type] || 0) + 1;
  }

  // Runtime hours
  const ledgerRows = ledgerRes.data || [];
  let totalRuntimeSeconds = 0;
  for (const e of ledgerRows) {
    if (e.entry_type === 'session_end' && e.duration_seconds) {
      totalRuntimeSeconds += e.duration_seconds;
    }
  }

  // Token consumption — sum from teams
  let totalTokens = 0;
  for (const t of allTeams) {
    totalTokens += (t as Record<string, unknown>).total_llm_calls as number || 0;
  }

  // Recent events
  const recentEvents = (recentEventsRes.data || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    event_type: e.event_type,
    summary_text: e.summary_text,
    team_name: (e.team as Record<string, string>)?.name || '未知团队',
    occurred_at: e.occurred_at,
  }));

  // Users list (join team data with auth users)
  // Since we can't easily join auth.users with team, build from teams
  const usersList = allTeams.map((t: Record<string, unknown>) => ({
    id: t.user_id,
    team_status: t.status,
    runtime_status: t.runtime_status,
    plan_tier: t.plan_tier || 'free',
    team_name: t.name,
    created_at: t.created_at,
  }));

  // Get user emails from auth admin API (paginated)
  let allUsers: Array<{ id: string; email: string; created_at: string; user_metadata?: Record<string, unknown> }> = [];
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const res = await db.auth.admin.listUsers({ page, perPage: 100 });
      const users = res.data?.users || [];
      allUsers = allUsers.concat(users as typeof allUsers);
      hasMore = users.length === 100;
      page++;
    }
  } catch {
    // auth admin API may fail, continue without emails
  }

  const userEmailMap = new Map(allUsers.map(u => [u.id, { email: u.email, display_name: u.user_metadata?.full_name as string || '', created_at: u.created_at }]));

  // Opportunity/submission counts per team
  const oppCountByTeam: Record<string, number> = {};
  for (const o of opps) {
    const tid = (o as Record<string, unknown>).team_id as string;
    if (tid) oppCountByTeam[tid] = (oppCountByTeam[tid] || 0) + 1;
  }

  // Build enriched user list
  const enrichedUsers = allTeams.map((t: Record<string, unknown>) => {
    const authInfo = userEmailMap.get(t.user_id as string);
    return {
      id: t.user_id,
      email: authInfo?.email || '',
      display_name: authInfo?.display_name || '',
      created_at: authInfo?.created_at || t.created_at,
      team_status: t.status,
      runtime_status: t.runtime_status,
      plan_tier: t.plan_tier || 'free',
      team_name: t.name,
    };
  });

  return ok({
    overview: {
      total_users: allUsers.length || allTeams.length,
      users_today: usersTodayRes.count || 0,
      users_7d: users7dRes.count || 0,
      total_teams: allTeams.length,
      teams_by_status: teamsByStatus,
      active_teams_now: activeTeamsNow,
    },
    platforms: {
      connections_by_platform: Object.values(platformMap),
      today_actions_by_platform: Object.values(actionMap),
    },
    funnel: {
      by_stage: byStage,
      today_discovered: todayDiscoveredRes.count || 0,
      today_submitted: todaySubmittedRes.count || 0,
      submission_outcomes: submissionOutcomes,
    },
    engine: {
      tasks_queued: tasksQueuedRes.count || 0,
      tasks_running: tasksRunningRes.count || 0,
      tasks_failed_24h: tasksFailed24hRes.count || 0,
      tasks_completed_24h: tasksCompleted24hRes.count || 0,
      tasks_by_type: tasksByType,
      total_tokens_used: totalTokens,
    },
    operations: {
      total_runtime_hours: Math.round(totalRuntimeSeconds / 3600 * 10) / 10,
      materials_generated: materialsRes.count || 0,
      handoffs_pending: handoffsPendingRes.count || 0,
      handoffs_by_type: handoffsByType,
      resumes_uploaded: resumesRes.count || 0,
    },
    recent_events: recentEvents,
    users: enrichedUsers,
  });
});
