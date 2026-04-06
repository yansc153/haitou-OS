import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /opportunities-list
 * Filterable, paginated opportunity list.
 *
 * Query params: stage, platform_id, priority, search, sort, cursor, limit
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § GET /api/ui/opportunities
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!.from('team').select('id').eq('user_id', user!.id).single();
  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const url = new URL(req.url);
  const stage = url.searchParams.get('stage');
  const platformId = url.searchParams.get('platform_id');
  const priority = url.searchParams.get('priority');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'latest_event_at';
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);

  let query = supabase!
    .from('opportunity')
    .select('id, company_name, job_title, location_label, stage, priority_level, source_platform_id, requires_takeover, latest_event_at, latest_event_summary, recommendation, fit_posture, created_at')
    .eq('team_id', team.id);

  if (stage) query = query.eq('stage', stage);
  if (platformId) query = query.eq('source_platform_id', platformId);
  if (priority) query = query.eq('priority_level', priority);
  if (search) {
    // Sanitize search input: strip PostgREST filter syntax characters
    const sanitized = search.replace(/[.,()"'\\%;:]/g, '').trim();
    if (sanitized) {
      query = query.or(`company_name.ilike.%${sanitized}%,job_title.ilike.%${sanitized}%`);
    }
  }

  // Sort
  if (sort === 'created_at') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('latest_event_at', { ascending: false, nullsFirst: false });
  }

  // Cursor-based pagination (must use same field as sort)
  const cursorField = sort === 'created_at' ? 'created_at' : 'latest_event_at';
  if (cursor) {
    query = query.lt(cursorField, cursor);
  }

  query = query.limit(limit + 1);

  const { data: rows, error: queryError } = await query;
  if (queryError) return err(500, 'INTERNAL_ERROR', queryError.message);

  const opportunities = rows || [];
  const hasMore = opportunities.length > limit;
  if (hasMore) opportunities.pop();

  const nextCursor = hasMore && opportunities.length > 0
    ? (opportunities[opportunities.length - 1] as Record<string, unknown>)[cursorField]
    : null;

  // Map material_ready → prioritized for frontend
  const mapped = opportunities.map((o: Record<string, unknown>) => ({
    ...o,
    stage: o.stage === 'material_ready' ? 'prioritized' : o.stage,
  }));

  // Get stage counts for summary
  const { data: stageCounts } = await supabase!
    .rpc('count_opportunities_by_stage', { p_team_id: team.id })
    .then(() => ({ data: null }), () => ({ data: null }));
  // RPC may not exist yet — fallback to inline count
  const { count: totalCount } = await supabase!
    .from('opportunity')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id);

  return ok({
    opportunities: mapped,
    total_count: totalCount || 0,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
});
