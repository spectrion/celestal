(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE
    ? fn()
    : (n < 100 && setTimeout(() => poll(fn,(n||0)+1), 50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;

    let host = '';
    try { host = new URL(BASE).hostname.toLowerCase(); } catch { return; }

    const isYT      = host.includes('youtube.com') || host.includes('youtu.be');
    const isTwitch  = host.includes('twitch.tv');
    if (!isYT && !isTwitch) return;

    const NativeURL = G.__NativeURL__ || URL;
    const pxy = url => {
      try {
        const abs = new NativeURL(url, BASE).href;
        return isProxied(abs) ? abs : toProxyUrl(abs);
      } catch { return url; }
    };
    const needsProxy = url => {
      if (!url || typeof url !== 'string') return false;
      if (/^(data:|blob:|javascript:)/.test(url)) return false;
      try { return !isProxied(new NativeURL(url, BASE).href); } catch { return false; }
    };

    function deepProxyUrls(obj, depth) {
      if (depth > 20 || !obj) return obj;
      if (typeof obj === 'string') {
        return /^https?:\/\//.test(obj) && needsProxy(obj) ? pxy(obj) : obj;
      }
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) obj[i] = deepProxyUrls(obj[i], depth+1);
      } else if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          try { obj[k] = deepProxyUrls(obj[k], depth+1); } catch {}
        }
      }
      return obj;
    }

    function interceptGlobal(name) {
      let stored;
      try {
        Object.defineProperty(G, name, {
          get()  { return stored; },
          set(v) { stored = deepProxyUrls(v, 0); },
          configurable: true,
        });
      } catch {}
    }

    function patchFetch(shouldProxy) {
      const _orig = G.fetch && G.fetch.bind ? G.fetch.bind(G) : fetch;
      G.fetch = async (input, init) => {
        try {
          let url = typeof input === 'string' ? input
            : input instanceof Request ? input.url : String(input);
          const abs = new NativeURL(url, BASE).href;
          if (shouldProxy(abs)) {
            url = pxy(abs);
            return _orig(typeof input === 'string' ? url : new Request(url, input), init);
          }
        } catch {}
        return _orig(input, init);
      };
    }

    function patchXHR(shouldProxy) {
      const _XHR = G.XMLHttpRequest;
      G.XMLHttpRequest = class CXhr extends _XHR {
        open(method, url, ...rest) {
          try {
            const abs = new NativeURL(url, BASE).href;
            if (shouldProxy(abs)) url = pxy(abs);
          } catch {}
          super.open(method, url, ...rest);
        }
      };
    }

    function autoClick(selectors, timeoutMs) {
      const iv = setInterval(() => {
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) { btn.click(); clearInterval(iv); return; }
        }
      }, 300);
      setTimeout(() => clearInterval(iv), timeoutMs || 15000);
    }

    if (isYT) {

      ['ytInitialData','ytInitialPlayerResponse','ytcfg','ytConfigData',
       '_ytInitialPlayerResponse','__ytInitialPlayerResponse__'].forEach(interceptGlobal);

      const ytDomains = [
        'youtube.com','youtu.be','ytimg.com','ggpht.com',
        'googleusercontent.com','googlevideo.com','googleapis.com',
        'accounts.google.com','suggestqueries.google.com',
      ];
      const needsYTProxy = abs => {
        if (!needsProxy(abs)) return false;
        try { return ytDomains.some(d => new NativeURL(abs).hostname.endsWith(d)); } catch { return false; }
      };

      patchFetch(needsYTProxy);
      patchXHR(needsYTProxy);

      autoClick([
        'button[aria-label*="Accept"]',
        '.eom-buttons button',
        'form[action*="consent"] button',
        'tp-yt-paper-button[aria-label*="Accept"]',
        '.VfPpkd-LgbsSe[jsname]',
      ], 20000);

      G.addEventListener('yt-navigate-finish', () => {
        document.querySelectorAll('img[src]').forEach(img => {
          const s = img.getAttribute('src');
          if (s && needsProxy(s)) try { img.src = pxy(s); } catch {}
        });
        document.querySelectorAll('[style*="background-image"]').forEach(el => {
          const s = el.style.backgroundImage;
          if (s) el.style.backgroundImage = s.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/g,
            (m, u) => needsProxy(u) ? `url(${pxy(u)})` : m);
        });
      });

      try {
        Object.defineProperty(G, 'yt', {
          get: () => G._cyt,
          set: v => {
            if (v && v.config_) {
              v.config_.LOGGED_IN = true;
              v.config_.IS_EMBEDDED = false;
            }
            G._cyt = v;
          },
          configurable: true,
        });
      } catch {}

      try {
        const _push = history.pushState.bind(history);
        const _rep  = history.replaceState.bind(history);
        const fixYTUrl = u => {
          if (!u || typeof u !== 'string') return u;
          if (u.startsWith('/watch') || u.startsWith('/results') || u.startsWith('/channel')) {
            return pxy(new NativeURL(u, BASE).href);
          }
          return u;
        };
        history.pushState    = (s,t,u) => _push(s, t, fixYTUrl(u));
        history.replaceState = (s,t,u) => _rep(s, t, fixYTUrl(u));
      } catch {}

    }

    if (isTwitch) {
      const twitchDomains = [
        'twitch.tv','twitchapps.com','twitchsvc.net',
        'jtvnw.net','static.twitchsvc.net','clips.twitch.tv',
      ];
      const needsTwitchProxy = abs => {
        if (!needsProxy(abs)) return false;
        try { return twitchDomains.some(d => new NativeURL(abs).hostname.endsWith(d)); } catch { return false; }
      };

      patchFetch(needsTwitchProxy);
      patchXHR(needsTwitchProxy);

      if (G.MediaSource) {
        const _addSB = MediaSource.prototype.addSourceBuffer;
        MediaSource.prototype.addSourceBuffer = function(mime) {
          return _addSB.call(this, mime);
        };
      }

      const moTwitch = new MutationObserver(muts => {
        muts.forEach(m => {
          m.addedNodes.forEach(node => {
            if (!node.tagName) return;
            if (node.tagName === 'VIDEO' || node.tagName === 'SOURCE') {
              const s = node.getAttribute('src');
              if (s && needsProxy(s)) try { node.setAttribute('src', pxy(s)); } catch {}
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('video[src],source[src]').forEach(el => {
                const s = el.getAttribute('src');
                if (s && needsProxy(s)) try { el.setAttribute('src', pxy(s)); } catch {}
              });
            }
          });
        });
      });
      document.addEventListener('DOMContentLoaded', () => {
        moTwitch.observe(document.body || document.documentElement, { childList:true, subtree:true });
      });
      if (document.body) moTwitch.observe(document.body, { childList:true, subtree:true });

      autoClick([
        '[data-a-target="player-overlay-mature-accept"]',
        '[data-a-target="content-classification-gate-overlay-start-watching-button"]',
        '.gate-button',
      ], 20000);

      const _replaceState = history.replaceState.bind(history);
      history.replaceState = (s,t,u) => {
        if (u && typeof u === 'string' && !u.startsWith('/celestial/')) {
          try { u = pxy(new NativeURL(u, BASE).href); } catch {}
        }
        _replaceState(s, t, u);
      };

    }

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);