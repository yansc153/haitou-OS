/**
 * Handoff Detection Service
 *
 * Detects handoff boundaries in conversation messages and creates
 * Handoff records with appropriate type classification.
 *
 * Source: AGENT_SKILL_AND_PROMPT_SPEC.md § handoff triggers
 * Source: DATA_MODEL_SPEC.md § HandoffType enum
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { validateOpportunityTransition } from '../../shared/state-machines.js';
import { OpportunityStage, HandoffType, HandoffState } from '../../shared/enums.js';

// Boundary detection patterns — keywords that trigger handoff
// Bilingual: Chinese and English patterns
const BOUNDARY_RULES: Array<{
  type: string;
  patterns_zh: RegExp[];
  patterns_en: RegExp[];
  urgency: string;
}> = [
  {
    type: HandoffType.PrivateContact,
    patterns_zh: [/微信/, /加我/, /电话/, /手机号/, /联系方式/, /WeChat/, /留个/, /方便联系/],
    patterns_en: [/phone\s*number/i, /whatsapp/i, /wechat/i, /personal\s*email/i, /contact\s*(?:me|you)\s*(?:at|on)/i, /give\s*(?:me|you)\s*(?:my|your)\s*number/i],
    urgency: 'high',
  },
  {
    type: HandoffType.SalaryConfirmation,
    patterns_zh: [/薪资/, /工资/, /待遇/, /薪酬/, /年薪/, /月薪/, /期望薪/, /报价/, /package/],
    patterns_en: [/salary/i, /compensation/i, /pay\s*range/i, /offer\s*(?:amount|details)/i, /total\s*comp/i, /base\s*\+/i, /equity/i, /stock\s*option/i],
    urgency: 'high',
  },
  {
    type: HandoffType.InterviewTime,
    patterns_zh: [/面试/, /约个时间/, /安排面试/, /几点/, /什么时候方便/, /视频面/, /电话面/, /现场面/],
    patterns_en: [/interview/i, /schedule\s*(?:a|an|the)\s*(?:call|meeting)/i, /available\s*(?:on|at|this)/i, /when\s*(?:are you|can you)/i, /time\s*(?:slot|zone)/i],
    urgency: 'critical',
  },
  {
    type: HandoffType.WorkArrangement,
    patterns_zh: [/到岗时间/, /入职/, /试用期/, /工作地点/, /是否接受/, /出差/],
    patterns_en: [/start\s*date/i, /onboarding/i, /relocation/i, /on-?site/i, /notice\s*period/i, /when\s*can\s*you\s*(?:start|join)/i],
    urgency: 'medium',
  },
  {
    type: HandoffType.VisaEligibility,
    patterns_zh: [/签证/, /工作许可/, /护照/, /身份/, /国籍/],
    patterns_en: [/visa/i, /work\s*(?:permit|authorization)/i, /sponsorship/i, /citizenship/i, /right\s*to\s*work/i],
    urgency: 'high',
  },
  {
    type: HandoffType.OfferDecision,
    patterns_zh: [/offer/, /录用/, /发offer/, /接受.*offer/, /入职通知/],
    patterns_en: [/(?:extend|send|receive)\s*(?:an?\s*)?offer/i, /offer\s*letter/i, /congrat/i, /we.d\s*like\s*to\s*offer/i],
    urgency: 'critical',
  },
];

export class HandoffDetectionService {
  constructor(private db: SupabaseClient) {}

  /**
   * Scan a message for handoff boundaries.
   * Returns detected boundary type or null.
   */
  detectBoundary(messageText: string): { type: string; urgency: string } | null {
    for (const rule of BOUNDARY_RULES) {
      const allPatterns = [...rule.patterns_zh, ...rule.patterns_en];
      for (const pattern of allPatterns) {
        if (pattern.test(messageText)) {
          return { type: rule.type, urgency: rule.urgency };
        }
      }
    }
    return null;
  }

  /**
   * Create a handoff record and transition the opportunity to needs_takeover.
   */
  async createHandoff(params: {
    teamId: string;
    opportunityId: string;
    handoffType: string;
    urgency: string;
    sourceAgentId?: string;
    sourceAgentRoleCode?: string;
    reason: string;
    contextSummary: string;
    suggestedNextAction?: string;
    suggestedReplyText?: string;
  }): Promise<{ handoffId: string } | { error: string }> {
    // Get current opportunity stage
    const { data: opp } = await this.db
      .from('opportunity')
      .select('stage')
      .eq('id', params.opportunityId)
      .single();

    if (!opp) return { error: 'Opportunity not found' };

    // Validate transition to needs_takeover
    const transition = validateOpportunityTransition(
      opp.stage as OpportunityStage,
      OpportunityStage.NeedsTakeover
    );

    if (!transition.valid) {
      return { error: `Cannot transition to needs_takeover: ${transition.error}` };
    }

    // Create handoff record
    const { data: handoff, error: insertError } = await this.db
      .from('handoff')
      .insert({
        team_id: params.teamId,
        opportunity_id: params.opportunityId,
        handoff_type: params.handoffType,
        state: HandoffState.AwaitingTakeover,
        urgency: params.urgency,
        source_agent_id: params.sourceAgentId,
        source_agent_role_code: params.sourceAgentRoleCode,
        handoff_reason: params.reason,
        context_summary: params.contextSummary,
        suggested_next_action: params.suggestedNextAction,
        suggested_reply_text: params.suggestedReplyText,
      })
      .select('id')
      .single();

    if (insertError) return { error: insertError.message };

    // Transition opportunity to needs_takeover
    await this.db
      .from('opportunity')
      .update({
        stage: OpportunityStage.NeedsTakeover,
        previous_stage: opp.stage,
        stage_changed_at: new Date().toISOString(),
        requires_takeover: true,
      })
      .eq('id', params.opportunityId);

    // Create timeline event
    await this.db.from('timeline_event').insert({
      team_id: params.teamId,
      event_type: 'handoff_created',
      summary_text: `Handoff needed: ${params.reason}`,
      actor_type: 'agent',
      actor_id: params.sourceAgentId,
      related_entity_type: 'handoff',
      related_entity_id: handoff!.id,
      visibility: 'feed',
    });

    return { handoffId: handoff!.id };
  }
}
