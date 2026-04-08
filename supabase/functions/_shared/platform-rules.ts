/**
 * Shared platform configuration — TTL, probe URLs, warning thresholds.
 * Single source of truth for platform-connect and platform-health-check.
 */

export const PLATFORM_TTL_HOURS: Record<string, number> = {
  linkedin: 24,
  boss_zhipin: 3,
  zhaopin: 24,
  lagou: 24,
  liepin: 12,
  greenhouse: 720,
  lever: 720,
};

export const PLATFORM_PROBE_URLS: Record<string, string> = {
  linkedin: 'https://www.linkedin.com/feed/',
  zhaopin: 'https://www.zhaopin.com/home',
  lagou: 'https://www.lagou.com/',
  boss_zhipin: 'https://www.zhipin.com/web/geek/job',
};

/** Warning threshold as fraction of TTL (e.g., 0.2 = warn when 20% remaining) */
export const WARNING_THRESHOLD = 0.2;

/** Platforms that don't need cookie auth */
export const NO_COOKIE_PLATFORMS = ['greenhouse', 'lever'];
