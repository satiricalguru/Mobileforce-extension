// MobileForce — MAIN world content script
// 1. Spoofs navigator properties (mobile browser)
// 2. Intercepts fetch/XHR responses from OTT subscription/entitlement APIs
//    across major platforms (Hotstar, JioCinema, SonyLIV, Zee5, Prime Video Mobile)
//    and patches payload restrictions to enable desktop browser playback.

(function () {
  'use strict';

  if (window.__MOBILEFORCE_APPLIED__) return;
  window.__MOBILEFORCE_APPLIED__ = true;

  function safeDefine(obj, prop, getter) {
    try {
      Object.defineProperty(obj, prop, { get: getter, configurable: true });
    } catch (e) {}
  }

  // ===== OTT API PATTERNS to intercept =====
  const OTT_PATTERNS = [
    /subscription/i,
    /entitlement/i,
    /user.*profile/i,
    /users\/me/i,
    /plan/i,
    /device.*capability/i,
    /platform.*check/i,
    /content.*rights/i,
    /playback/i,
    /v1\/page\//i,
    /v2\/page\//i,
    /v3\/page\//i,
    /check.*rights/i,
    /validate.*device/i,
    /device.*limit/i,
    /account.*status/i
  ];

  function isSubscriptionAPI(url) {
    try {
      return OTT_PATTERNS.some(p => p.test(url));
    } catch {
      return false;
    }
  }

  // ===== Patch subscription/entitlement data =====
  function patchResponseData(data, url) {
    if (!data || typeof data !== 'object') return data;

    const json = JSON.stringify(data);
    let patched = json;

    // 1. Platform & Device Array Restrictions
    patched = patched.replace(/"allowedPlatforms"\s*:\s*\["mobile"\]/gi, '"allowedPlatforms":["mobile","web","desktop","tablet"]');
    patched = patched.replace(/"allowed_platforms"\s*:\s*\["mobile"\]/gi, '"allowed_platforms":["mobile","web","desktop","tablet"]');
    patched = patched.replace(/"supportedPlatforms"\s*:\s*\["mobile"\]/gi, '"supportedPlatforms":["mobile","web","desktop","tablet"]');
    patched = patched.replace(/"restrictedToDevices"\s*:\s*\["mobile"\]/gi, '"restrictedToDevices":["mobile","web","desktop"]');
    patched = patched.replace(/"deviceCategory"\s*:\s*"mobile"/gi, '"deviceCategory":"web"');
    patched = patched.replace(/"device_category"\s*:\s*"mobile"/gi, '"device_category":"web"');

    // 2. Boolean App & Mobile Flags
    patched = patched.replace(/"isAppOnly"\s*:\s*true/gi, '"isAppOnly":false');
    patched = patched.replace(/"appOnly"\s*:\s*true/gi, '"appOnly":false');
    patched = patched.replace(/"mobileOnly"\s*:\s*true/gi, '"mobileOnly":false');
    patched = patched.replace(/"is_mobile_only"\s*:\s*true/gi, '"is_mobile_only":false');
    patched = patched.replace(/"app_only"\s*:\s*true/gi, '"app_only":false');
    patched = patched.replace(/"mobile_only"\s*:\s*true/gi, '"mobile_only":false');
    patched = patched.replace(/"device_limit_exceeded"\s*:\s*true/gi, '"device_limit_exceeded":false');
    patched = patched.replace(/"stream_limit_reached"\s*:\s*true/gi, '"stream_limit_reached":false');

    // 3. Web Playback Permissions
    patched = patched.replace(/"allowedOnWeb"\s*:\s*false/gi, '"allowedOnWeb":true');
    patched = patched.replace(/"webAllowed"\s*:\s*false/gi, '"webAllowed":true');
    patched = patched.replace(/"allowed_on_web"\s*:\s*false/gi, '"allowed_on_web":true');
    patched = patched.replace(/"web_allowed"\s*:\s*false/gi, '"web_allowed":true');
    patched = patched.replace(/"isWebAllowed"\s*:\s*false/gi, '"isWebAllowed":true');
    patched = patched.replace(/"is_playback_allowed"\s*:\s*false/gi, '"is_playback_allowed":true');
    patched = patched.replace(/"playback_allowed"\s*:\s*false/gi, '"playback_allowed":true');

    // 4. Plan Upgrade Transforms (Mobile Plan -> Super/Premium)
    patched = patched.replace(/"planType"\s*:\s*"mobile"/gi, '"planType":"super"');
    patched = patched.replace(/"plan_type"\s*:\s*"mobile"/gi, '"plan_type":"super"');
    patched = patched.replace(/"planName"\s*:\s*"Mobile[^"]*"/gi, '"planName":"Super"');
    patched = patched.replace(/"plan_name"\s*:\s*"Mobile[^"]*"/gi, '"plan_name":"Super"');
    patched = patched.replace(/"deviceRestriction"\s*:\s*"mobile"/gi, '"deviceRestriction":"none"');

    // 5. Error Code Clears
    patched = patched.replace(/"error_code"\s*:\s*"MOBILE_ONLY_PLAN"/gi, '"error_code":null');

    // 6. Max Screens Expansion
    patched = patched.replace(/"maxScreens"\s*:\s*1/gi, '"maxScreens":4');

    if (patched !== json) {
      console.log(
        '%c[MobileForce]%c Intercepted & Unblocked API Response: ' + new URL(url, location.href).pathname,
        'color: #38bdf8; font-weight: bold;',
        'color: #10b981;'
      );
      return JSON.parse(patched);
    }

    return data;
  }

  function applyMobileSpoofs(config) {
    try {
      if (!config || !config.enabled) return;

      const d = config.deviceInfo;
      if (!d || !d.userAgent) return;

      const isIOS = d.platform === 'ios' || d.userAgent.includes('iPhone') || d.userAgent.includes('iPad');

      // --- Navigator Overrides ---
      safeDefine(navigator, 'userAgent', () => d.userAgent);
      safeDefine(navigator, 'appVersion', () => d.userAgent.replace('Mozilla/', ''));
      safeDefine(navigator, 'platform', () => isIOS ? (d.userAgent.includes('iPad') ? 'iPad' : 'iPhone') : 'Linux armv8l');
      safeDefine(navigator, 'vendor', () => isIOS ? 'Apple Computer, Inc.' : 'Google Inc.');
      safeDefine(navigator, 'maxTouchPoints', () => 5);
      safeDefine(navigator, 'userAgentData', () => undefined);

      // --- Touch Event Support ---
      try { window.ontouchstart = null; } catch (e) {}

      // ===== FETCH INTERCEPTOR — patch subscription API responses =====
      const _fetch = window.fetch;
      window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : (input?.url || '');
        const response = await _fetch.call(window, input, init);

        if (!isSubscriptionAPI(url)) return response;

        try {
          const clone = response.clone();
          const contentType = response.headers.get('content-type') || '';

          if (!contentType.includes('json')) return response;

          const data = await clone.json();
          const patched = patchResponseData(data, url);

          if (patched !== data) {
            return new Response(JSON.stringify(patched), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
        } catch (e) {
          // Fallback to original response on parse error
        }

        return response;
      };

      // ===== XHR INTERCEPTOR =====
      const _xhrOpen = XMLHttpRequest.prototype.open;
      const _xhrSend = XMLHttpRequest.prototype.send;
      const _xhrGetResponseText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

      XMLHttpRequest.prototype.open = function (...args) {
        this.__mf_url = args[1] || '';
        this.__mf_intercept = isSubscriptionAPI(this.__mf_url);
        return _xhrOpen.apply(this, args);
      };

      if (_xhrGetResponseText && _xhrGetResponseText.get) {
        Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
          get: function () {
            const text = _xhrGetResponseText.get.call(this);
            if (!this.__mf_intercept || !text) return text;

            try {
              const data = JSON.parse(text);
              const patched = patchResponseData(data, this.__mf_url);
              if (patched !== data) {
                return JSON.stringify(patched);
              }
            } catch (e) {}

            return text;
          },
          configurable: true
        });
      }

      const device = d.name || 'mobile device';
      console.log(
        `%c[MobileForce]%c Active → ${device} (${isIOS ? 'iOS' : 'Android'} Multi-OTT Payload Interceptor Running)`,
        'color: #38bdf8; font-weight: bold;',
        'color: #10b981;'
      );

    } catch (e) {
      console.warn('[MobileForce] Error:', e);
    }
  }

  window.addEventListener('__mobileforce_config__', (e) => {
    if (e.detail) applyMobileSpoofs(e.detail);
  });

  if (window.__MOBILEFORCE_CONFIG__) {
    applyMobileSpoofs(window.__MOBILEFORCE_CONFIG__);
  }
})();
