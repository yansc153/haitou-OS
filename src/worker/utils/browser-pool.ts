/**
 * Browser Pool — Shared Playwright browser management.
 *
 * - Lazy-init singleton Chromium browser
 * - Create contexts with optional cookie injection
 * - Cleanup on shutdown
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Supporting Infrastructure
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import { decrypt, isEncrypted } from './vault.js';
import { generateStealthJs } from './stealth.js';

let _browser: Browser | null = null;
let _launchPromise: Promise<Browser> | null = null;

/**
 * Get or create the shared Chromium browser instance.
 * Uses a launch promise guard to prevent concurrent launches.
 */
export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launchPromise) return _launchPromise;

  _launchPromise = chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
    ],
  }).then((b: Browser) => {
    _browser = b;
    _launchPromise = null;
    console.log('[browser-pool] Chromium launched');
    return b;
  }).catch((err: Error) => {
    _launchPromise = null;
    throw err;
  });

  return _launchPromise;
}

/**
 * Create a browser context with optional cookie injection.
 * Used for authenticated platform actions.
 */
export async function createContext(options?: {
  cookies?: string; // Encrypted or raw cookie string/JSON
  userAgent?: string;
}): Promise<BrowserContext> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent: options?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
  });

  // Inject stealth anti-detection before any page scripts run
  await context.addInitScript(generateStealthJs());

  // Inject cookies if provided
  if (options?.cookies) {
    let cookieData: string;
    if (isEncrypted(options.cookies)) {
      cookieData = decrypt(options.cookies);
    } else {
      cookieData = options.cookies;
    }

    try {
      const parsed = JSON.parse(cookieData);
      if (Array.isArray(parsed)) {
        // Chrome extension format: [{name, value, domain, path, ...}]
        const playwrightCookies = parsed.map((c: Record<string, unknown>) => ({
          name: c.name as string,
          value: c.value as string,
          domain: c.domain as string,
          path: (c.path as string) || '/',
          httpOnly: (c.httpOnly as boolean) ?? false,
          secure: (c.secure as boolean) ?? true,
          sameSite: 'Lax' as const,
          expires: -1,
        }));
        await context.addCookies(playwrightCookies);
      }
    } catch {
      console.warn('[browser-pool] Failed to parse cookies, proceeding without auth');
    }
  }

  return context;
}

/**
 * Create an ephemeral context (no cookies, for Greenhouse/Lever).
 */
export async function createEphemeralContext(): Promise<BrowserContext> {
  return createContext();
}

/**
 * Close the shared browser instance. Call during worker shutdown.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
    console.log('[browser-pool] Chromium closed');
  }
}

/**
 * Utility: wait with randomized delay (anti-bot pattern).
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
