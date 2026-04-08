/**
 * Haitou OS Bridge — Content Script
 *
 * Injected into matching pages to broadcast the extension's ID.
 * This eliminates the need for the web app to know the extension ID in advance.
 */

// Broadcast extension ID to the page
function broadcastExtensionId() {
  window.postMessage({
    type: 'HAITOU_EXTENSION_READY',
    extensionId: chrome.runtime.id,
    version: chrome.runtime.getManifest().version,
  }, '*');
}

// Broadcast immediately and on page load
broadcastExtensionId();
window.addEventListener('load', broadcastExtensionId);

// Also broadcast when the page requests it (for re-detection)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'HAITOU_CHECK_EXTENSION') {
    broadcastExtensionId();
  }
});

// Relay bridge requests from page to background service worker
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'HAITOU_BRIDGE_REQUEST') return;

  const { requestId, action, payload } = event.data;

  try {
    const response = await chrome.runtime.sendMessage({ action, ...payload });
    window.postMessage({
      type: 'HAITOU_BRIDGE_RESPONSE',
      requestId,
      response,
    }, '*');
  } catch (err) {
    window.postMessage({
      type: 'HAITOU_BRIDGE_RESPONSE',
      requestId,
      response: { error: err.message || 'bridge_error' },
    }, '*');
  }
});
