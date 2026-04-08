/**
 * Chrome Extension Bridge — shared communication module.
 *
 * Detection strategy:
 * 1. Content script (content.js) broadcasts extension ID via window.postMessage
 * 2. This module listens for HAITOU_EXTENSION_READY events and caches the ID
 * 3. sendBridgeMessage uses the cached ID, falling back to env var
 * 4. For cookie fetching, can also relay via content script (HAITOU_BRIDGE_REQUEST)
 */

declare const chrome: {
  runtime?: {
    sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
    lastError?: { message: string };
  };
} | undefined;

export type BridgeResponse = {
  installed?: boolean;
  version?: string;
  bridgeVersion?: string;
  cookies?: string | null;
  needsLogin?: boolean;
  error?: string;
  debug?: Record<string, unknown>;
};

// Cached extension ID (set by content script via postMessage)
let _cachedExtId: string | null = null;
let _listenerAttached = false;

function attachListener() {
  if (_listenerAttached || typeof window === 'undefined') return;
  _listenerAttached = true;
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'HAITOU_EXTENSION_READY') {
      _cachedExtId = event.data.extensionId;
    }
  });
}

function getExtensionId(): string {
  attachListener();
  return _cachedExtId || process.env.NEXT_PUBLIC_BRIDGE_EXTENSION_ID || '';
}

/** Request the content script to re-broadcast its ID */
export function requestExtensionCheck() {
  if (typeof window !== 'undefined') {
    window.postMessage({ type: 'HAITOU_CHECK_EXTENSION' }, '*');
  }
}

/** Send a message to the extension's background service worker */
export function sendBridgeMessage(msg: Record<string, unknown>): Promise<BridgeResponse> {
  return new Promise(resolve => {
    const extId = getExtensionId();

    // Try direct chrome.runtime.sendMessage first (works if externally_connectable matches)
    if (extId && typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage(extId, msg, (response) => {
          if (chrome?.runtime?.lastError) {
            // Direct message failed — try content script relay
            relayViaContentScript(msg).then(resolve);
          } else {
            resolve((response as BridgeResponse) || { error: 'empty_response' });
          }
        });
        return;
      } catch {
        // Fall through to content script relay
      }
    }

    // No direct access — try content script relay
    relayViaContentScript(msg).then(resolve);
  });
}

/** Relay a message via the content script (postMessage → content.js → background.js) */
function relayViaContentScript(msg: Record<string, unknown>): Promise<BridgeResponse> {
  return new Promise(resolve => {
    if (typeof window === 'undefined') {
      resolve({ error: 'no_window' });
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ error: 'timeout' });
    }, 5000);

    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type !== 'HAITOU_BRIDGE_RESPONSE') return;
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve(event.data.response as BridgeResponse || { error: 'empty_relay_response' });
    }

    window.addEventListener('message', handler);
    window.postMessage({
      type: 'HAITOU_BRIDGE_REQUEST',
      requestId,
      action: msg.action,
      payload: msg,
    }, '*');
  });
}

export async function checkExtensionInstalled(): Promise<{ installed: boolean; version?: string }> {
  // First try to trigger content script re-broadcast
  requestExtensionCheck();
  await new Promise(r => setTimeout(r, 200)); // Give content script time to respond

  // Check if we got the ID from content script
  if (_cachedExtId) {
    return { installed: true, version: undefined };
  }

  // Try direct bridge message as fallback
  const res = await sendBridgeMessage({ action: 'checkInstalled' });
  if (res.installed) {
    return { installed: true, version: res.version };
  }

  return { installed: false };
}

export async function getCookiesForPlatform(platformCode: string): Promise<BridgeResponse> {
  return sendBridgeMessage({ action: 'getCookies', platform: platformCode });
}

/** Listen for the extension ready event — call the callback when detected */
export function onExtensionReady(callback: (extId: string) => void): () => void {
  attachListener();

  // Already detected
  if (_cachedExtId) {
    callback(_cachedExtId);
    return () => {};
  }

  // Listen for future detection
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.type === 'HAITOU_EXTENSION_READY') {
      callback(event.data.extensionId);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
