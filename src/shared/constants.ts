/**
 * Shared constants used across frontend, Edge Functions, and Worker.
 * Single source of truth — do not duplicate these definitions elsewhere.
 */

export const AGENT_ROSTER = [
  { role_code: 'orchestrator', title_zh: '调度官', persona: 'Commander' },
  { role_code: 'profile_intelligence', title_zh: '履历分析师', persona: 'Analyst' },
  { role_code: 'materials_advisor', title_zh: '简历顾问', persona: 'Advisor' },
  { role_code: 'opportunity_research', title_zh: '岗位研究员', persona: 'Scout' },
  { role_code: 'matching_review', title_zh: '匹配审核员', persona: 'Reviewer' },
  { role_code: 'application_executor', title_zh: '投递专员', persona: 'Executor' },
  { role_code: 'relationship_manager', title_zh: '招聘关系经理', persona: 'Liaison' },
] as const;

export type AgentRoleCode = typeof AGENT_ROSTER[number]['role_code'];

export const PLAN_ALLOCATIONS: Record<string, number> = {
  free: 21600,   // 6h
  pro: 28800,    // 8h
  plus: 86400,   // 24h
};
