/**
 * Browser Bridge v1.1.0 — Background Service Worker
 *
 * Key change from v1.0.0:
 * - LinkedIn: only require 'li_at' (removed JSESSIONID requirement)
 * - All platforms: broader domain matching
 * - getCookies returns debug info (raw cookie count per domain)
 */

const PLATFORMS = {
  linkedin: {
    // Try multiple domain patterns
    domains: ['.linkedin.com', 'www.linkedin.com', 'linkedin.com'],
    keyCookies: ['li_at'], // Only require li_at — JSESSIONID may not exist anymore
  },
  zhaopin: {
    domains: ['.zhaopin.com', 'www.zhaopin.com', 'sou.zhaopin.com'],
    keyCookies: null,
  },
  lagou: {
    domains: ['.lagou.com', 'www.lagou.com'],
    keyCookies: null,
  },
  boss_zhipin: {
    // Boss uses multiple subdomains
    domains: ['.zhipin.com', 'www.zhipin.com', 'login.zhipin.com'],
    keyCookies: null,
  },
  liepin: {
    domains: ['.liepin.com', 'www.liepin.com', 'c.liepin.com'],
    keyCookies: null,
  },
};

/**
 * Read ALL cookies for a platform. Returns { cookies: string|null, debug: object }.
 */
async function readPlatformCookies(platformCode) {
  const platform = PLATFORMS[platformCode];
  if (!platform) return { cookies: null, debug: { error: 'unknown platform' } };

  const debug = { domains: {}, totalRaw: 0, totalAfterFilter: 0, keyCookiesFound: [] };
  const allCookies = [];
  const seenKeys = new Set(); // dedupe across domains

  for (const domain of platform.domains) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      debug.domains[domain] = cookies.length;
      debug.totalRaw += cookies.length;

      for (const c of cookies) {
        const key = `${c.domain}|${c.name}|${c.path}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        if (platform.keyCookies) {
          if (platform.keyCookies.includes(c.name)) {
            allCookies.push(c);
            debug.keyCookiesFound.push(c.name);
          }
        } else {
          allCookies.push(c);
        }
      }
    } catch (e) {
      debug.domains[domain] = `error: ${e.message}`;
    }
  }

  debug.totalAfterFilter = allCookies.length;

  if (allCookies.length === 0) {
    return { cookies: null, debug };
  }

  // For platforms with key cookies, check required ones exist
  if (platform.keyCookies) {
    const foundNames = new Set(allCookies.map(c => c.name));
    const missing = platform.keyCookies.filter(k => !foundNames.has(k));
    if (missing.length > 0) {
      debug.missingKeyCookies = missing;
      return { cookies: null, debug };
    }
  }

  // Filter out expired cookies
  const now = Date.now() / 1000;
  const validCookies = allCookies.filter(c => !c.expirationDate || c.expirationDate > now);
  debug.validCount = validCookies.length;

  if (validCookies.length === 0) {
    debug.allExpired = true;
    return { cookies: null, debug };
  }

  const serialized = JSON.stringify(
    validCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate,
    }))
  );

  return { cookies: serialized, debug };
}

/**
 * Handle messages from the web app.
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const { action, platform } = message || {};

  switch (action) {
    case 'checkInstalled':
      sendResponse({
        installed: true,
        version: chrome.runtime.getManifest().version,
        bridgeVersion: '1.1.0',
      });
      break;

    case 'getCookies':
      if (!platform || !PLATFORMS[platform]) {
        sendResponse({ cookies: null, needsLogin: false, noCookieNeeded: true });
        break;
      }
      readPlatformCookies(platform).then(({ cookies, debug }) => {
        sendResponse({
          cookies,
          needsLogin: !cookies,
          debug, // include debug info so frontend can show what happened
        });
      });
      return true;

    case 'connect':
    case 'loginAndCapture':
      // For now, just do getCookies — no tab opening
      if (!platform || !PLATFORMS[platform]) {
        sendResponse({ error: `Platform "${platform}" not supported` });
        break;
      }
      readPlatformCookies(platform).then(({ cookies, debug }) => {
        if (cookies) {
          sendResponse({ cookies, debug });
        } else {
          sendResponse({ error: 'no_cookies', debug });
        }
      });
      return true;

    default:
      sendResponse({ error: 'Unknown action', receivedAction: action });
  }
});
