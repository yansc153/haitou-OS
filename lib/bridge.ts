/**
 * Chrome Extension Bridge — shared communication module.
 * Used by both the onboarding extension page and the platforms page.
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

export function sendBridgeMessage(msg: Record<string, unknown>): Promise<BridgeResponse> {
  return new Promise(resolve => {
    const extId = process.env.NEXT_PUBLIC_BRIDGE_EXTENSION_ID || '';
    if (!extId || typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      resolve({ error: 'no_extension' });
      return;
    }
    try {
      chrome.runtime.sendMessage(extId, msg, (response) => {
        if (chrome?.runtime?.lastError) {
          resolve({ error: 'not_installed' });
        } else {
          resolve((response as BridgeResponse) || { error: 'empty_response' });
        }
      });
    } catch {
      resolve({ error: 'not_installed' });
    }
  });
}

export async function checkExtensionInstalled(): Promise<{ installed: boolean; version?: string }> {
  const res = await sendBridgeMessage({ action: 'checkInstalled' });
  return { installed: !!res.installed, version: res.version };
}

export async function getCookiesForPlatform(platformCode: string): Promise<BridgeResponse> {
  return sendBridgeMessage({ action: 'getCookies', platform: platformCode });
}
