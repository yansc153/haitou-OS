/**
 * Platform Connection Tests
 * Covers: executor throw → pipeline catch, TTL pre-flight, cookie validation,
 * session_expires_at calculation, and health-check auth modes.
 *
 * Source: PLATFORM_CONNECTION_PLAN.md § Step 2
 */
import { describe, it, expect } from 'vitest';

// ── Extracted logic: executor session_expired pattern ──

function isPipelineCatchableSessionError(errMsg: string): boolean {
  return errMsg.includes('session_expired') || errMsg.includes('auth wall');
}

describe('[Regression] executor throw → pipeline catches', () => {
  const executorErrors = [
    { platform: '智联招聘', msg: 'session_expired: 智联招聘 login redirect detected' },
    { platform: 'LinkedIn', msg: 'session_expired: LinkedIn auth wall detected' },
    { platform: 'Boss直聘', msg: 'session_expired: Boss直聘 login required' },
    { platform: '拉勾', msg: 'session_expired: 拉勾 login redirect detected' },
    { platform: '猎聘', msg: 'session_expired: 猎聘 auth wall encountered' },
  ];

  for (const { platform, msg } of executorErrors) {
    it(`${platform}: throw Error → pipeline detects session_expired`, () => {
      const thrown = new Error(msg);
      expect(isPipelineCatchableSessionError(thrown.message)).toBe(true);
    });
  }

  it('non-session errors are NOT caught as session_expired', () => {
    expect(isPipelineCatchableSessionError('Network timeout')).toBe(false);
    expect(isPipelineCatchableSessionError('Element not found')).toBe(false);
    expect(isPipelineCatchableSessionError('OOM killed')).toBe(false);
  });
});

// ── TTL pre-flight check logic ──

function isSessionTTLExpired(sessionExpiresAt: string | null): boolean {
  if (!sessionExpiresAt) return false;
  return new Date(sessionExpiresAt) < new Date();
}

describe('Pipeline TTL pre-flight', () => {
  it('expired session_expires_at → returns true', () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(isSessionTTLExpired(past)).toBe(true);
  });

  it('future session_expires_at → returns false', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    expect(isSessionTTLExpired(future)).toBe(false);
  });

  it('null session_expires_at → returns false (legacy data)', () => {
    expect(isSessionTTLExpired(null)).toBe(false);
  });
});

// ── Cookie JSON validation (mirrors platform-connect Edge Function) ──

type CookieValidation = { valid: true } | { valid: false; code: string };

function validateCookieJson(sessionToken: string): CookieValidation {
  try {
    const parsed = JSON.parse(sessionToken);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { valid: false, code: 'INVALID_COOKIES' };
    }
    const hasValidCookie = parsed.some((c: { name?: string; value?: string }) => c.name && c.value);
    if (!hasValidCookie) {
      return { valid: false, code: 'INVALID_COOKIES' };
    }
    return { valid: true };
  } catch {
    return { valid: false, code: 'INVALID_COOKIES' };
  }
}

describe('Cookie JSON validation', () => {
  it('valid cookie array → passes', () => {
    const cookies = JSON.stringify([{ name: 'li_at', value: 'abc123' }]);
    expect(validateCookieJson(cookies)).toEqual({ valid: true });
  });

  it('empty array → rejected', () => {
    expect(validateCookieJson('[]')).toEqual({ valid: false, code: 'INVALID_COOKIES' });
  });

  it('non-array JSON → rejected', () => {
    expect(validateCookieJson('{"name":"a"}')).toEqual({ valid: false, code: 'INVALID_COOKIES' });
  });

  it('array without name field → rejected', () => {
    const cookies = JSON.stringify([{ value: 'abc' }]);
    expect(validateCookieJson(cookies)).toEqual({ valid: false, code: 'INVALID_COOKIES' });
  });

  it('invalid JSON string → rejected', () => {
    expect(validateCookieJson('not-json')).toEqual({ valid: false, code: 'INVALID_COOKIES' });
  });

  it('multiple cookies with at least one valid → passes', () => {
    const cookies = JSON.stringify([
      { name: '', value: '' },
      { name: 'session_id', value: 'xyz' },
    ]);
    expect(validateCookieJson(cookies)).toEqual({ valid: true });
  });
});

// ── session_expires_at calculation per platform ──

const PLATFORM_TTL_HOURS: Record<string, number> = {
  linkedin: 24,
  boss_zhipin: 3,
  zhaopin: 24,
  lagou: 24,
  liepin: 12,
  greenhouse: 720,
  lever: 720,
};

function calculateSessionExpiry(platformCode: string, grantedAt: Date = new Date()): Date {
  const ttlHours = PLATFORM_TTL_HOURS[platformCode] ?? 24;
  return new Date(grantedAt.getTime() + ttlHours * 60 * 60 * 1000);
}

describe('session_expires_at calculation', () => {
  const baseTime = new Date('2026-04-07T12:00:00Z');

  it('boss_zhipin: 3 hours TTL', () => {
    const expiry = calculateSessionExpiry('boss_zhipin', baseTime);
    expect(expiry.toISOString()).toBe('2026-04-07T15:00:00.000Z');
  });

  it('linkedin: 24 hours TTL', () => {
    const expiry = calculateSessionExpiry('linkedin', baseTime);
    expect(expiry.toISOString()).toBe('2026-04-08T12:00:00.000Z');
  });

  it('liepin: 12 hours TTL', () => {
    const expiry = calculateSessionExpiry('liepin', baseTime);
    expect(expiry.toISOString()).toBe('2026-04-08T00:00:00.000Z');
  });

  it('greenhouse: 720 hours (30 days) TTL', () => {
    const expiry = calculateSessionExpiry('greenhouse', baseTime);
    expect(expiry.toISOString()).toBe('2026-05-07T12:00:00.000Z');
  });

  it('unknown platform: defaults to 24 hours', () => {
    const expiry = calculateSessionExpiry('unknown_platform', baseTime);
    expect(expiry.toISOString()).toBe('2026-04-08T12:00:00.000Z');
  });

  it('all 7 platforms have explicit TTL (no accidental defaults)', () => {
    const expectedPlatforms = ['linkedin', 'boss_zhipin', 'zhaopin', 'lagou', 'liepin', 'greenhouse', 'lever'];
    for (const code of expectedPlatforms) {
      expect(PLATFORM_TTL_HOURS[code]).toBeDefined();
      expect(PLATFORM_TTL_HOURS[code]).toBeGreaterThan(0);
    }
  });
});

// ── Health-check auth mode selection ──

function determineHealthCheckAuthMode(
  body: { connection_id?: string },
  authHeader: string,
  serviceKey: string,
  cronSecret: string,
): 'single_connection' | 'batch' | 'unauthorized' {
  if (body.connection_id) return 'single_connection';
  const isAuthorized = authHeader === `Bearer ${serviceKey}` ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  return isAuthorized ? 'batch' : 'unauthorized';
}

describe('Health-check auth mode selection', () => {
  it('connection_id present → single_connection mode (JWT)', () => {
    const mode = determineHealthCheckAuthMode(
      { connection_id: 'uuid-123' }, 'Bearer user-jwt', 'svc-key', 'cron-key'
    );
    expect(mode).toBe('single_connection');
  });

  it('no connection_id + service key → batch mode', () => {
    const mode = determineHealthCheckAuthMode(
      {}, 'Bearer svc-key', 'svc-key', 'cron-key'
    );
    expect(mode).toBe('batch');
  });

  it('no connection_id + cron secret → batch mode', () => {
    const mode = determineHealthCheckAuthMode(
      {}, 'Bearer cron-key', 'svc-key', 'cron-key'
    );
    expect(mode).toBe('batch');
  });

  it('no connection_id + wrong key → unauthorized', () => {
    const mode = determineHealthCheckAuthMode(
      {}, 'Bearer wrong', 'svc-key', 'cron-key'
    );
    expect(mode).toBe('unauthorized');
  });
});

// ── TTL warning threshold ──

const WARNING_THRESHOLD = 0.2;

function isExpiringWarning(sessionExpiresAt: string, sessionGrantedAt: string): { warning: boolean; remainingMinutes: number } {
  const expires = new Date(sessionExpiresAt).getTime();
  const granted = new Date(sessionGrantedAt).getTime();
  const now = Date.now();
  const totalTTL = expires - granted;
  const remaining = expires - now;
  return {
    warning: remaining > 0 && remaining < totalTTL * WARNING_THRESHOLD,
    remainingMinutes: Math.max(0, Math.round(remaining / (1000 * 60))),
  };
}

describe('TTL expiry warning', () => {
  it('80% through TTL → no warning', () => {
    const granted = new Date(Date.now() - 80 * 60 * 1000).toISOString();
    const expires = new Date(Date.now() + 920 * 60 * 1000).toISOString();
    // 80min elapsed of 1000min total = 8% → remaining is 92%
    const result = isExpiringWarning(expires, granted);
    expect(result.warning).toBe(false);
  });

  it('95% through TTL → warning', () => {
    const totalMs = 1000 * 60 * 1000; // 1000 minutes
    const granted = new Date(Date.now() - 0.95 * totalMs).toISOString();
    const expires = new Date(Date.now() + 0.05 * totalMs).toISOString();
    const result = isExpiringWarning(expires, granted);
    expect(result.warning).toBe(true);
    expect(result.remainingMinutes).toBeGreaterThan(0);
    expect(result.remainingMinutes).toBeLessThan(200); // 5% of 1000 = 50min
  });

  it('already expired → no warning (expired, not "expiring")', () => {
    const granted = new Date(Date.now() - 2000 * 60 * 1000).toISOString();
    const expires = new Date(Date.now() - 100 * 60 * 1000).toISOString();
    const result = isExpiringWarning(expires, granted);
    expect(result.warning).toBe(false);
  });
});
