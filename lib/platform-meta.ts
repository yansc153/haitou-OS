/**
 * Shared platform metadata — used by both onboarding and platforms pages.
 */

export const NO_COOKIE_PLATFORMS = ['greenhouse', 'lever'];

export type PlatformMeta = {
  logo: string;
  displayName: string;
  tagline: string;
  features: string[];
  limits: string;
  needsPlugin: boolean;
  region: 'en' | 'cn';
};

export const PLATFORM_META: Record<string, PlatformMeta> = {
  greenhouse: {
    logo: '🏢', displayName: 'Greenhouse', tagline: '英文 ATS 门户 · 海外科技公司首选',
    features: ['自动搜索岗位', 'AI 定制简历', '自动表单投递'],
    limits: '每日最多 30 次投递', needsPlugin: false, region: 'en',
  },
  lever: {
    logo: '⚡', displayName: 'Lever', tagline: '英文 ATS 门户 · 快速增长公司常用',
    features: ['自动搜索岗位', 'AI 定制简历', '自动表单投递'],
    limits: '每日最多 30 次投递', needsPlugin: false, region: 'en',
  },
  linkedin: {
    logo: '💼', displayName: 'LinkedIn', tagline: '全球最大职业社交网络',
    features: ['自动搜索岗位', 'AI 定制简历', 'Easy Apply 一键投递', '消息跟进'],
    limits: '每日 15 次投递 · 10 条消息', needsPlugin: true, region: 'en',
  },
  boss_zhipin: {
    logo: '💬', displayName: 'Boss直聘', tagline: '移动端直聊招聘 · 中国最活跃平台',
    features: ['自动搜索岗位', '批量投递', '自动打招呼', 'AI 对话跟进', '面试信号检测'],
    limits: '每日 10 次投递 · 10 条消息', needsPlugin: true, region: 'cn',
  },
  zhaopin: {
    logo: '🔵', displayName: '智联招聘', tagline: '中国主流招聘平台',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 30 次投递', needsPlugin: true, region: 'cn',
  },
  lagou: {
    logo: '🟢', displayName: '拉勾', tagline: '互联网行业垂直招聘',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 30 次投递', needsPlugin: true, region: 'cn',
  },
  liepin: {
    logo: '🦁', displayName: '猎聘', tagline: '中高端人才招聘',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 20 次投递', needsPlugin: true, region: 'cn',
  },
};

export const PLATFORM_ORDER = ['greenhouse', 'lever', 'linkedin', 'boss_zhipin', 'zhaopin', 'lagou', 'liepin'] as const;

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  active: { bg: 'bg-status-active/10', text: 'text-status-active', label: '已连接', dot: 'bg-status-active' },
  available_unconnected: { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', label: '未连接', dot: 'bg-muted-foreground/30' },
  pending_login: { bg: 'bg-status-info/10', text: 'text-status-info', label: '连接中', dot: 'bg-status-info' },
  session_expired: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: '已过期', dot: 'bg-status-warning' },
  plan_locked: { bg: 'bg-accent/15', text: 'text-accent', label: '需升级', dot: 'bg-accent' },
};

export type PlatformEntry = {
  platform_id: string;
  code: string;
  display_name: string;
  display_name_zh: string;
  pipeline_mode: string;
  anti_scraping_level: string;
  min_plan_tier: string;
  connection_id: string | null;
  connection_status: string;
  capability_status: Record<string, string> | null;
  session_expires_at: string | null;
  session_granted_at: string | null;
  failure_reason: string | null;
};
