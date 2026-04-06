/**
 * Browser Bridge — Background Service Worker
 *
 * Handles messages from the web app via externally_connectable.
 * Three actions: checkInstalled, getCookies, loginAndCapture.
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Cookie Extraction Methods
 */

const PLATFORMS = {
  linkedin: {
    domains: ['.linkedin.com'],
    loginUrl: 'https://www.linkedin.com/login',
    keyCookies: ['li_at', 'JSESSIONID'],
  },
  zhaopin: {
    domains: ['.zhaopin.com'],
    loginUrl: 'https://www.zhaopin.com/',
    keyCookies: null, // all cookies
  },
  lagou: {
    domains: ['.lagou.com'],
    loginUrl: 'https://www.lagou.com/',
    keyCookies: null,
  },
  boss_zhipin: {
    domains: ['.zhipin.com'],
    loginUrl: 'https://www.zhipin.com/web/user/?ka=header-login',
    keyCookies: null, // all cookies — Boss changes cookie names frequently
  },
  liepin: {
    domains: ['.liepin.com'],
    loginUrl: 'https://www.liepin.com/',
    keyCookies: null,
  },
};

/**
 * Read cookies for a platform. Returns serialized array or null.
 */
async function readPlatformCookies(platformCode) {
  const platform = PLATFORMS[platformCode];
  if (!platform) return null;

  const allCookies = [];
  for (const domain of platform.domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    if (platform.keyCookies) {
      allCookies.push(...cookies.filter(c => platform.keyCookies.includes(c.name)));
    } else {
      allCookies.push(...cookies);
    }
  }

  if (allCookies.length === 0) return null;

  // Check key cookies exist (for platforms that require specific ones)
  if (platform.keyCookies) {
    const foundNames = new Set(allCookies.map(c => c.name));
    const hasAllKeys = platform.keyCookies.every(k => foundNames.has(k));
    if (!hasAllKeys) return null;
  }

  return JSON.stringify(
    allCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate,
    }))
  );
}

/**
 * Open login page and monitor for cookie changes.
 * Resolves when key auth cookies appear.
 */
function loginAndCapture(platformCode) {
  return new Promise((resolve, reject) => {
    const platform = PLATFORMS[platformCode];
    if (!platform) {
      reject(new Error(`Unknown platform: ${platformCode}`));
      return;
    }

    let loginTabId = null;
    let loginStartTime = Date.now();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Login timeout (5 minutes)'));
    }, 5 * 60 * 1000);

    function cleanup() {
      clearTimeout(timeout);
      chrome.cookies.onChanged.removeListener(onCookieChanged);
    }

    async function onCookieChanged(changeInfo) {
      // Only care about cookies being set (not removed)
      if (changeInfo.removed) return;

      const cookie = changeInfo.cookie;
      // Check if this cookie belongs to our platform
      const isOurDomain = platform.domains.some(d =>
        cookie.domain === d || cookie.domain.endsWith(d)
      );
      if (!isOurDomain) return;

      // For platforms with key cookies, only trigger on those specific cookies
      if (platform.keyCookies && !platform.keyCookies.includes(cookie.name)) return;

      // For platforms without key cookies (keyCookies=null), skip initial page-load cookies.
      // Only trigger on cookies set after a reasonable login delay (5s after tab opened).
      if (!platform.keyCookies && loginTabId && (Date.now() - loginStartTime) < 5000) return;

      // Key cookie detected — user has logged in.
      // Remove listener immediately to prevent re-entry, then settle.
      cleanup();
      setTimeout(async () => {
        const cookies = await readPlatformCookies(platformCode);
        if (cookies) {
          resolve(cookies);
        } else {
          reject(new Error('Cookie capture failed after login detected'));
        }
      }, 1000);
    }

    chrome.cookies.onChanged.addListener(onCookieChanged);

    // Open login page
    chrome.tabs.create({ url: platform.loginUrl }, (tab) => {
      loginTabId = tab.id;
    });
  });
}

/**
 * Handle messages from the web app via externally_connectable.
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const { action, platform } = message || {};

  switch (action) {
    case 'checkInstalled':
      sendResponse({ installed: true, version: chrome.runtime.getManifest().version });
      break;

    case 'getCookies':
      if (!platform || !PLATFORMS[platform]) {
        sendResponse({ cookies: null, needsLogin: false, noCookieNeeded: true });
        break;
      }
      readPlatformCookies(platform).then(cookies => {
        if (cookies) {
          sendResponse({ cookies });
        } else {
          sendResponse({ cookies: null, needsLogin: true });
        }
      });
      return true; // async response

    case 'loginAndCapture':
      if (!platform || !PLATFORMS[platform]) {
        sendResponse({ error: `Platform "${platform}" does not use cookie auth` });
        break;
      }
      loginAndCapture(platform).then(
        cookies => sendResponse({ cookies }),
        err => sendResponse({ error: err.message })
      );
      return true; // async response

    default:
      sendResponse({ error: 'Unknown action' });
  }
});
