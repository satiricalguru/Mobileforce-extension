// MobileForce — Service Worker
// Strategy v3: Mobile browser UA + subscription response interception.

const DEVICES = {
  galaxy_s25: {
    name: 'Galaxy S25 Ultra',
    os: 'Android 15',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Mobile Safari/537.36',
    width: 412,
    height: 915,
    pixelRatio: 3.5,
    platform: 'android'
  },
  pixel_9: {
    name: 'Pixel 9 Pro',
    os: 'Android 15',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Mobile Safari/537.36',
    width: 412,
    height: 915,
    pixelRatio: 3.5,
    platform: 'android'
  },
  iphone_17: {
    name: 'iPhone 17 Pro Max',
    os: 'iOS 19',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    width: 430,
    height: 932,
    pixelRatio: 3,
    platform: 'ios'
  },
  ipad_pro_m4: {
    name: 'iPad Pro 13" (M4)',
    os: 'iPadOS 18.2',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    width: 1024,
    height: 1366,
    pixelRatio: 2,
    platform: 'ios'
  }
};

// ---------- Initialisation ----------
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['enabled', 'device']);
  if (existing.enabled === undefined) {
    await chrome.storage.local.set({ enabled: false, device: 'galaxy_s25' });
  }
  await syncRules();
  await updateBadge();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.device) {
    await syncRules();
    await updateBadge();
    await notifyContentScripts();
  }
});

// ---------- Dynamic Header Rules ----------
async function syncRules() {
  const { enabled = false, device = 'galaxy_s25' } = await chrome.storage.local.get(['enabled', 'device']);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map(r => r.id);

  if (!enabled) {
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const deviceInfo = DEVICES[device] || DEVICES.galaxy_s25;
  const isIOS = deviceInfo.platform === 'ios';

  const addRules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'User-Agent', operation: 'set', value: deviceInfo.userAgent },
          { header: 'Sec-CH-UA-Mobile', operation: 'set', value: '?1' },
          { header: 'Sec-CH-UA-Platform', operation: 'set', value: isIOS ? '"iOS"' : '"Android"' }
        ]
      },
      condition: {
        resourceTypes: [
          'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
          'font', 'object', 'xmlhttprequest', 'ping', 'media',
          'websocket', 'other'
        ]
      }
    }
  ];

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

// ---------- Badge ----------
async function updateBadge() {
  const { enabled = false } = await chrome.storage.local.get('enabled');
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
}

// ---------- Notify content scripts ----------
async function notifyContentScripts() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || !tab.url.startsWith('http')) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SPOOF_STATE_CHANGED' });
      } catch { /* no content script */ }
    }
  } catch { /* query failed */ }
}

// ---------- Message handling ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    (async () => {
      const { enabled = false, device = 'galaxy_s25' } = await chrome.storage.local.get(['enabled', 'device']);
      const deviceInfo = DEVICES[device] || DEVICES.galaxy_s25;
      sendResponse({ enabled, device, deviceInfo });
    })();
    return true;
  }
});
