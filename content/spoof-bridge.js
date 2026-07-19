// MobileForce — Bridge content script (ISOLATED world)
// Fetches config from the service worker via chrome.runtime
// and passes it to the MAIN world script via CustomEvent.

(function () {
  'use strict';

  async function fetchAndBroadcastConfig() {
    try {
      const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (!config) return;

      // Dispatch config to the MAIN world script
      window.dispatchEvent(
        new CustomEvent('__mobileforce_config__', { detail: config })
      );
    } catch {
      // Extension context invalidated, tab reloading, etc.
    }
  }

  // Listen for state changes from the service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SPOOF_STATE_CHANGED') {
      fetchAndBroadcastConfig();
    }
  });

  fetchAndBroadcastConfig();
})();
