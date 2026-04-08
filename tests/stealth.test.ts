/**
 * Tests for T014: Stealth anti-detection module
 */
import { describe, it, expect } from 'vitest';
import { generateStealthJs } from '../src/worker/utils/stealth';

describe('T014: Stealth module', () => {
  const js = generateStealthJs();

  it('returns a non-empty string', () => {
    expect(typeof js).toBe('string');
    expect(js.length).toBeGreaterThan(1000);
  });

  it('contains navigator.webdriver patch', () => {
    expect(js).toContain('navigator');
    expect(js).toContain('webdriver');
  });

  it('contains window.chrome stub', () => {
    expect(js).toContain('window.chrome');
    expect(js).toContain('runtime');
    expect(js).toContain('loadTimes');
  });

  it('contains plugin population', () => {
    expect(js).toContain('PDF Viewer');
    expect(js).toContain('navigator.plugins');
  });

  it('contains automation artifact cleanup', () => {
    expect(js).toContain('__playwright');
    expect(js).toContain('__puppeteer');
    expect(js).toContain('cdc_');
  });

  it('contains stack trace sanitization', () => {
    expect(js).toContain('puppeteer_evaluation_script');
    expect(js).toContain('Error.prototype');
  });

  it('contains Function.prototype.toString disguise', () => {
    expect(js).toContain('WeakMap');
    expect(js).toContain('[native code]');
  });

  it('contains anti-debugger trap', () => {
    expect(js).toContain('debugger');
    expect(js).toContain('_PatchedFunction');
  });

  it('contains console method defense', () => {
    expect(js).toContain('_consoleMethods');
  });

  it('contains outerWidth/outerHeight defense', () => {
    expect(js).toContain('outerWidth');
    expect(js).toContain('outerHeight');
  });

  it('contains Performance API cleanup', () => {
    expect(js).toContain('Performance.prototype');
    expect(js).toContain('getEntries');
  });

  it('contains iframe chrome consistency', () => {
    expect(js).toContain('HTMLIFrameElement');
    expect(js).toContain('contentWindow');
  });

  it('contains double-injection guard', () => {
    expect(js).toContain('EventTarget.prototype');
    expect(js).toContain('__lsn');
  });

  it('is wrapped in IIFE', () => {
    expect(js.trim()).toMatch(/^\s*\(\(\) =>/);
    expect(js.trim()).toMatch(/\)\(\)\s*$/);
  });
});
