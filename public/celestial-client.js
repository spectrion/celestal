(function(G) {
  'use strict';

  const KEY    = 0x42;
  const PREFIX = G.__C_PREFIX__ || G.__CELESTIAL_PREFIX__ || '/celestial/';
  const BARE   = G.__C_BARE__   || G.__CELESTIAL_BARE__   || '/.netlify/functions/bare';
  const BASE   = G.__C_BASE__   || G.__CELESTIAL_BASE__   || '';

  function enc(str) {
    const b = new TextEncoder().encode(String(str));
    return btoa(String.fromCharCode(...b.map(v => v ^ KEY)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }
  function dec(str) {
    try {
      const b = atob(str.replace(/-/g,'+').replace(/_/g,'/'));
      return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0) ^ KEY));
    } catch { return null; }
  }

  function toProxyUrl(url, base) {
    try {
      const resolved = new URL(url, base || BASE || G.location.href);
      if (/^(data:|blob:|javascript:|mailto:|tel:)/.test(resolved.href)) return url;
      return PREFIX + enc(resolved.href);
    } catch { return url; }
  }

  function isProxied(url) {
    try { return new URL(url, G.location.href).pathname.startsWith(PREFIX); }
    catch { return false; }
  }

  const Celestial = {
    enc, dec, toProxyUrl, isProxied, PREFIX, BARE, BASE,

    async register() {
      if (!('serviceWorker' in navigator))
        throw new Error('Service workers not supported');

      const src = `/celestial-sw.js?bare=${encodeURIComponent(BARE)}&prefix=${encodeURIComponent(PREFIX)}`;

      const reg = await navigator.serviceWorker.register(src, {
        scope: PREFIX,
        updateViaCache: 'none',
      });

      if (reg.active) return reg;

      await new Promise((resolve) => {
        const sw = reg.installing || reg.waiting;
        if (!sw) { resolve(); return; }
        const onStateChange = () => {
          if (sw.state === 'activated' || sw.state === 'redundant') {
            sw.removeEventListener('statechange', onStateChange);
            resolve();
          }
        };
        sw.addEventListener('statechange', onStateChange);

        setTimeout(resolve, 5000);
      });

      return reg;
    },

    async checkBare() {
      try {
        const r = await fetch(BARE + '?_check=1', { method:'GET', cache:'no-store' });
        return r.status < 500;
      } catch { return false; }
    },
  };

  if (!BASE) { G.Celestial = Celestial; return; }

  let baseObj;
  try { baseObj = new URL(BASE); } catch { G.Celestial = Celestial; return; }

  try {
    const realLoc = G.location;
    const fakeLoc = new Proxy(realLoc, {
      get(t, p) {
        switch(p) {
          case 'href':     return BASE;
          case 'origin':   return baseObj.origin;
          case 'host':     return baseObj.host;
          case 'hostname': return baseObj.hostname;
          case 'port':     return baseObj.port;
          case 'pathname': return baseObj.pathname;
          case 'search':   return baseObj.search;
          case 'hash':     return baseObj.hash;
          case 'protocol': return baseObj.protocol;
          case 'toString': return () => BASE;
          case 'assign':   return u => { G.location.href = toProxyUrl(u, BASE); };
          case 'replace':  return u => { G.location.href = toProxyUrl(u, BASE); };
          case 'reload':   return () => t.reload();
        }
        const v = t[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set(t, p, v) {
        if (p === 'href') { G.location.href = toProxyUrl(v, BASE); return true; }
        t[p] = v; return true;
      },
    });
    Object.defineProperty(G, 'location', { get: () => fakeLoc, configurable: true });
  } catch {}

  ['domain','hostname'].forEach(p => {
    try { Object.defineProperty(document, p, { get: () => baseObj[p === 'domain' ? 'hostname' : p], configurable: true }); } catch {}
  });
  try { Object.defineProperty(document, 'URL', { get: () => BASE, configurable: true }); } catch {}
  try { Object.defineProperty(document, 'referrer', { get: () => BASE, configurable: true }); } catch {}

  try {
    const _push = history.pushState.bind(history);
    const _rep  = history.replaceState.bind(history);
    history.pushState    = (s,t,u) => _push(s, t, u ? toProxyUrl(u, BASE) : u);
    history.replaceState = (s,t,u) => _rep(s,  t, u ? toProxyUrl(u, BASE) : u);
  } catch {}

  const _open = G.open && G.open.bind(G);
  if (_open) G.open = (url, ...a) => _open(url ? toProxyUrl(url, BASE) : url, ...a);

  const _fetch = G.fetch;
  if (_fetch) {
    G.fetch = (input, init) => {
      try {
        let url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (!isProxied(url) && !/^(data:|blob:|javascript:)/.test(url)) {
          url = toProxyUrl(url, BASE);
          input = typeof input === 'string' ? url : new Request(url, input);
        }
      } catch {}
      return _fetch(input, init);
    };
  }

  const _XHR = G.XMLHttpRequest;
  G.XMLHttpRequest = class extends _XHR {
    open(method, url, ...rest) {
      try {
        if (!isProxied(url) && !/^(data:|blob:)/.test(url))
          url = toProxyUrl(url, BASE);
      } catch {}
      super.open(method, url, ...rest);
    }
  };

  if (navigator.sendBeacon) {
    const _sb = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      try { if (!isProxied(url)) url = toProxyUrl(url, BASE); } catch {}
      return _sb(url, data);
    };
  }

  document.addEventListener('click', e => {
    const a = e.target && e.target.closest('a[href]');
    if (!a) return;
    const raw = a.getAttribute('href');
    if (!raw || /^(javascript:|#|mailto:|tel:)/.test(raw)) return;
    try {
      const abs = new URL(raw, BASE).href;
      if (!isProxied(abs)) {
        e.preventDefault(); e.stopPropagation();
        G.location.href = toProxyUrl(abs);
      }
    } catch {}
  }, true);

  document.addEventListener('submit', e => {
    const form = e.target; if (!form) return;
    try {
      const action = form.getAttribute('action') || BASE;
      const abs    = new URL(action, BASE).href;
      if (isProxied(abs)) return;
      e.preventDefault(); e.stopPropagation();
      if ((form.method || 'get').toUpperCase() === 'GET') {
        const dest = new URL(abs);
        dest.search = new URLSearchParams(new FormData(form)).toString();
        G.location.href = toProxyUrl(dest.href);
      } else {
        form.action = toProxyUrl(abs);
        form.submit();
      }
    } catch {}
  }, true);

  G.Celestial = Celestial;
})(typeof globalThis !== 'undefined' ? globalThis : window);
