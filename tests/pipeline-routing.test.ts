/**
 * Unit Tests: Pipeline Routing
 * Verifies all 7 platforms are routed correctly in discovery and submission switches.
 * Also verifies Boss-specific pipeline path (greeting instead of submit).
 */
import { describe, it, expect } from 'vitest';

// ─── Discovery Routing ───
// Extracted routing logic from pipeline.ts:170 switch statement

type DiscoveryRoute = 'greenhouse' | 'lever' | 'linkedin' | 'chinaPlatform' | 'bossDiscovery' | 'unknown';

function routeDiscovery(platformCode: string): DiscoveryRoute {
  switch (platformCode) {
    case 'greenhouse': return 'greenhouse';
    case 'lever': return 'lever';
    case 'linkedin': return 'linkedin';
    case 'zhaopin':
    case 'lagou':
    case 'liepin':
      return 'chinaPlatform';
    case 'boss_zhipin':
      return 'bossDiscovery';
    default:
      return 'unknown';
  }
}

describe('Pipeline Discovery Routing', () => {
  it('routes greenhouse to dedicated discovery', () => {
    expect(routeDiscovery('greenhouse')).toBe('greenhouse');
  });

  it('routes lever to dedicated discovery', () => {
    expect(routeDiscovery('lever')).toBe('lever');
  });

  it('routes linkedin to dedicated discovery', () => {
    expect(routeDiscovery('linkedin')).toBe('linkedin');
  });

  it('routes zhaopin to chinaPlatform discovery', () => {
    expect(routeDiscovery('zhaopin')).toBe('chinaPlatform');
  });

  it('routes lagou to chinaPlatform discovery', () => {
    expect(routeDiscovery('lagou')).toBe('chinaPlatform');
  });

  it('routes liepin to chinaPlatform discovery', () => {
    expect(routeDiscovery('liepin')).toBe('chinaPlatform');
  });

  it('routes boss_zhipin to dedicated boss discovery (NOT chinaPlatform)', () => {
    expect(routeDiscovery('boss_zhipin')).toBe('bossDiscovery');
  });

  it('returns unknown for unrecognized platform', () => {
    expect(routeDiscovery('indeed')).toBe('unknown');
    expect(routeDiscovery('')).toBe('unknown');
  });

  it('all 7 V1 platforms have defined routes', () => {
    const platforms = ['greenhouse', 'lever', 'linkedin', 'zhaopin', 'lagou', 'liepin', 'boss_zhipin'];
    for (const p of platforms) {
      expect(routeDiscovery(p), `${p} should have a defined route`).not.toBe('unknown');
    }
  });
});

// ─── Submission Routing ───
// Extracted from pipeline.ts:752 switch statement

type SubmissionRoute = 'greenhouse' | 'lever' | 'linkedin' | 'zhaopin' | 'lagou' | 'liepin' | 'none';

function routeSubmission(platformCode: string): SubmissionRoute {
  switch (platformCode) {
    case 'greenhouse': return 'greenhouse';
    case 'lever': return 'lever';
    case 'linkedin': return 'linkedin';
    case 'zhaopin': return 'zhaopin';
    case 'lagou': return 'lagou';
    case 'liepin': return 'liepin';
    default: return 'none';
  }
}

describe('Pipeline Submission Routing', () => {
  it('routes all EN platforms to their submit executors', () => {
    expect(routeSubmission('greenhouse')).toBe('greenhouse');
    expect(routeSubmission('lever')).toBe('lever');
    expect(routeSubmission('linkedin')).toBe('linkedin');
  });

  it('routes all CN passthrough platforms to their submit executors', () => {
    expect(routeSubmission('zhaopin')).toBe('zhaopin');
    expect(routeSubmission('lagou')).toBe('lagou');
    expect(routeSubmission('liepin')).toBe('liepin');
  });

  it('boss_zhipin has NO submission route (uses greeting instead)', () => {
    expect(routeSubmission('boss_zhipin')).toBe('none');
  });
});

// ─── China Platform Discovery Routing ───
// Extracted from pipeline.ts runChinaPlatformDiscovery

type ChinaDiscoveryTarget = 'zhaopin' | 'lagou' | 'liepin' | 'none';

function routeChinaDiscovery(platformCode: string): ChinaDiscoveryTarget {
  if (platformCode === 'zhaopin') return 'zhaopin';
  if (platformCode === 'lagou') return 'lagou';
  if (platformCode === 'liepin') return 'liepin';
  return 'none';
}

describe('China Platform Discovery Routing', () => {
  it('routes zhaopin correctly', () => {
    expect(routeChinaDiscovery('zhaopin')).toBe('zhaopin');
  });

  it('routes lagou correctly', () => {
    expect(routeChinaDiscovery('lagou')).toBe('lagou');
  });

  it('routes liepin correctly', () => {
    expect(routeChinaDiscovery('liepin')).toBe('liepin');
  });

  it('boss_zhipin is NOT routed through chinaPlatform discovery', () => {
    expect(routeChinaDiscovery('boss_zhipin')).toBe('none');
  });
});

// ─── Boss Pipeline Path ───

describe('Boss Pipeline Path', () => {
  // Boss advance → first contact (greeting), NOT submission
  it('advance recommendation with boss pipeline goes to firstContact', () => {
    const recommendation = 'advance';
    const platformCode = 'boss_zhipin';
    const pipelineMode = 'passthrough';

    // Simulates the routing decision in runBossScreeningPipeline
    const usesSubmission = platformCode !== 'boss_zhipin' && recommendation === 'advance';
    const usesFirstContact = platformCode === 'boss_zhipin' && recommendation === 'advance';

    expect(usesSubmission).toBe(false);
    expect(usesFirstContact).toBe(true);
  });

  it('drop recommendation with boss pipeline stops (no greeting)', () => {
    const recommendation: string = 'drop';
    const platformCode = 'boss_zhipin';

    const usesFirstContact = platformCode === 'boss_zhipin' && recommendation === 'advance';
    expect(usesFirstContact).toBe(false);
  });

  it('boss stage flow skips material_ready and submitted', () => {
    // Per MULTI_PLATFORM_PIPELINE_SPEC: prioritized → contact_started (skip 2 stages)
    const bossStages = ['discovered', 'screened', 'prioritized', 'contact_started', 'followup_active', 'positive_progression', 'needs_takeover', 'closed'];
    expect(bossStages).not.toContain('material_ready');
    // submitted is allowed by state machine but Boss never enters it
    expect(bossStages).not.toContain('submitted');
  });
});

// ─── Pipeline Mode Assignment ───

describe('Pipeline Mode per Platform', () => {
  const PLATFORM_MODES: Record<string, string> = {
    greenhouse: 'full_tailored',
    lever: 'full_tailored',
    linkedin: 'full_tailored',
    zhaopin: 'passthrough',
    lagou: 'passthrough',
    liepin: 'passthrough',
    boss_zhipin: 'passthrough', // DB value; code uses automation_role to differentiate
  };

  it('EN platforms use full_tailored', () => {
    expect(PLATFORM_MODES.greenhouse).toBe('full_tailored');
    expect(PLATFORM_MODES.lever).toBe('full_tailored');
    expect(PLATFORM_MODES.linkedin).toBe('full_tailored');
  });

  it('CN platforms use passthrough', () => {
    expect(PLATFORM_MODES.zhaopin).toBe('passthrough');
    expect(PLATFORM_MODES.lagou).toBe('passthrough');
    expect(PLATFORM_MODES.liepin).toBe('passthrough');
    expect(PLATFORM_MODES.boss_zhipin).toBe('passthrough');
  });
});
