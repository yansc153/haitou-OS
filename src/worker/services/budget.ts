/**
 * Daily Action Budget Service
 *
 * Tracks per-platform daily usage against configured limits.
 * Uses platform_daily_usage table (upserted per connection per day).
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Rate Limiting + V1 Rule Packs
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type ActionType = 'application' | 'message' | 'search';

const PLATFORM_BUDGETS: Record<string, { applications: number; messages: number; searches: number }> = {
  linkedin: { applications: 15, messages: 10, searches: 50 },
  greenhouse: { applications: 30, messages: 0, searches: 100 },
  lever: { applications: 30, messages: 0, searches: 100 },
  zhaopin: { applications: 30, messages: 0, searches: 100 },
  lagou: { applications: 30, messages: 0, searches: 100 },
  boss_zhipin: { applications: 10, messages: 5, searches: 50 },
  liepin: { applications: 20, messages: 0, searches: 100 },
};

export class BudgetService {
  constructor(private db: SupabaseClient) {}

  /**
   * Check if a platform action is allowed under the daily budget.
   * Returns true if the action can proceed.
   */
  async canPerformAction(
    connectionId: string,
    teamId: string,
    platformCode: string,
    actionType: ActionType,
  ): Promise<boolean> {
    const budget = PLATFORM_BUDGETS[platformCode];
    if (!budget) return true; // Unknown platform, allow

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: usage } = await this.db
      .from('platform_daily_usage')
      .select('applications_count, messages_count, searches_count, budget_exhausted')
      .eq('platform_connection_id', connectionId)
      .eq('date', today)
      .single();

    if (!usage) return true; // No usage record yet = 0 actions = OK

    if (usage.budget_exhausted) return false;

    switch (actionType) {
      case 'application': return usage.applications_count < budget.applications;
      case 'message': return usage.messages_count < budget.messages;
      case 'search': return usage.searches_count < budget.searches;
      default: return true;
    }
  }

  /**
   * Record a completed action and increment the daily counter.
   * Marks budget_exhausted if any limit is hit.
   */
  async recordAction(
    connectionId: string,
    teamId: string,
    platformCode: string,
    actionType: ActionType,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Upsert daily record
    const { data: existing } = await this.db
      .from('platform_daily_usage')
      .select('id, applications_count, messages_count, searches_count')
      .eq('platform_connection_id', connectionId)
      .eq('date', today)
      .single();

    if (!existing) {
      // Create new record
      const counts = { applications_count: 0, messages_count: 0, searches_count: 0 };
      if (actionType === 'application') counts.applications_count = 1;
      if (actionType === 'message') counts.messages_count = 1;
      if (actionType === 'search') counts.searches_count = 1;

      await this.db.from('platform_daily_usage').insert({
        platform_connection_id: connectionId,
        team_id: teamId,
        date: today,
        ...counts,
        total_actions_count: 1,
        last_action_at: now,
      });
    } else {
      // Increment existing
      // Compute new counts first, then set total
      const newAppsCount = existing.applications_count + (actionType === 'application' ? 1 : 0);
      const newMsgsCount = existing.messages_count + (actionType === 'message' ? 1 : 0);
      const newSearchCount = existing.searches_count + (actionType === 'search' ? 1 : 0);

      const updates: Record<string, unknown> = {
        applications_count: newAppsCount,
        messages_count: newMsgsCount,
        searches_count: newSearchCount,
        total_actions_count: newAppsCount + newMsgsCount + newSearchCount,
        last_action_at: now,
        updated_at: now,
      };

      // Check if any budget is now exhausted (only check limits > 0)
      const budget = PLATFORM_BUDGETS[platformCode];
      if (budget) {
        const newApps = (updates.applications_count as number) ?? existing.applications_count;
        const newMsgs = (updates.messages_count as number) ?? existing.messages_count;
        const appsExhausted = budget.applications > 0 && newApps >= budget.applications;
        const msgsExhausted = budget.messages > 0 && newMsgs >= budget.messages;
        if (appsExhausted || msgsExhausted) {
          updates.budget_exhausted = true;
        }
      }

      await this.db
        .from('platform_daily_usage')
        .update(updates)
        .eq('id', existing.id);
    }
  }
}
