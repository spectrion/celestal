(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n<60 && setTimeout(()=>poll(fn,(n||0)+1),50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;
    const NativeURL = G.__NativeURL__ || URL;

    const pxy = url => { try { return toProxyUrl(new NativeURL(url,BASE).href); } catch { return url; } };
    const ok  = url => url && !isProxied(url) && !/^(data:|blob:)/.test(url);

    document.addEventListener('error', e => {
      const el = e.target;
      if (!el || !el.tagName) return;
      const tag = el.tagName.toLowerCase();

      if (['img','script','audio','video','source'].includes(tag)) {
        const src = el.getAttribute('src') || el.src;
        if (src && ok(src) && !el.__celestialRetried) {
          el.__celestialRetried = true;
          el.src = pxy(src);
        }
      }
      if (tag === 'link') {
        const href = el.getAttribute('href') || el.href;
        if (href && ok(href) && !el.__celestialRetried) {
          el.__celestialRetried = true;
          el.href = pxy(href);
        }
      }
    }, true);

    const _setAttribute = Element.prototype.setAttribute;
    const UPGRADE_ATTRS = new Set(['src','href','action','data']);

    G.addEventListener('unhandledrejection', e => {

      if (e.reason && e.reason.message) {
        const msg = String(e.reason.message).toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('celestial')) {
          e.preventDefault();
        }
      }
    });

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);