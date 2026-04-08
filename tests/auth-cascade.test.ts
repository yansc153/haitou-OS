/**
 * Tests for T015: Auth Strategy Cascade
 */
import { describe, it, expect } from 'vitest';
import { cascadeProbe, probeEndpoint, type CascadeResult } from '../src/worker/services/auth-cascade';

// Mock page that simulates different auth behaviors
function mockPage(behavior: 'public' | 'cookie_only' | 'csrf_needed' | 'all_fail') {
  return {
    evaluate: async (js: string): Promise<Record<string, unknown>> => {
      // Detect which strategy is being used from the JS
      const usesCreds = js.includes("credentials: 'include'");
      const usesCsrf = js.includes('X-Csrf-Token');

      switch (behavior) {
        case 'public':
          return { status: 200, ok: true, hasData: true };
        case 'cookie_only':
          if (!usesCreds) return { status: 403, ok: false };
          return { status: 200, ok: true, hasData: true };
        case 'csrf_needed':
          if (!usesCreds) return { status: 403, ok: false };
          if (!usesCsrf) return { status: 403, ok: false };
          return { status: 200, ok: true, hasData: true };
        case 'all_fail':
          return { status: 401, ok: false };
      }
    },
  };
}

describe('T015: Auth Strategy Cascade', () => {
  it('finds PUBLIC when endpoint is public', async () => {
    const result = await cascadeProbe(mockPage('public'), 'https://example.com/api');
    expect(result.bestStrategy).toBe('public');
    expect(result.confidence).toBe(1.0);
    expect(result.probes.length).toBe(1);
  });

  it('finds COOKIE when endpoint needs auth cookies', async () => {
    const result = await cascadeProbe(mockPage('cookie_only'), 'https://example.com/api');
    expect(result.bestStrategy).toBe('cookie');
    expect(result.confidence).toBe(0.9);
    expect(result.probes.length).toBe(2);
    expect(result.probes[0].success).toBe(false); // public failed
    expect(result.probes[1].success).toBe(true);   // cookie worked
  });

  it('finds HEADER when endpoint needs CSRF', async () => {
    const result = await cascadeProbe(mockPage('csrf_needed'), 'https://example.com/api');
    expect(result.bestStrategy).toBe('header');
    expect(result.confidence).toBe(0.8);
    expect(result.probes.length).toBe(3);
  });

  it('defaults to COOKIE at low confidence when all fail', async () => {
    const result = await cascadeProbe(mockPage('all_fail'), 'https://example.com/api');
    expect(result.bestStrategy).toBe('cookie');
    expect(result.confidence).toBe(0.3);
    expect(result.probes.length).toBe(3);
    expect(result.probes.every(p => !p.success)).toBe(true);
  });

  it('probeEndpoint returns error for unsupported strategy', async () => {
    const result = await probeEndpoint(mockPage('public'), 'https://x.com', 'ui');
    expect(result.success).toBe(false);
    expect(result.error).toContain('site-specific');
  });
});
