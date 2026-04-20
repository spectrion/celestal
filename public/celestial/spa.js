(function(G) {
  'use strict';

  const poll = (fn, n) => G.Celestial && G.Celestial.BASE
    ? fn() : (n < 80 && setTimeout(() => poll(fn, (n||0)+1), 50));

  poll(() => {
    const { toProxyUrl, isProxied, BASE, PREFIX } = G.Celestial;
    if (!BASE) return;

    const NativeURL = G.__NativeURL__ || URL;
    const pxy  = url => { try { return toProxyUrl(new NativeURL(url, BASE).href); } catch { return url; } };
    const ok   = url => url && !isProxied(url) && !/^(data:|blob:|javascript:|#)/.test(url);

    const _dispatchEvent = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(e) {
      if (e.type === 'click' && e.target) {
        const a = e.target.closest && e.target.closest('a[href]');
        if (a) {
          const raw = a.getAttribute('href');
          if (raw && !/^(javascript:|#|mailto:|tel:)/.test(raw.trim())) {
            try {
              const abs = new NativeURL(raw, BASE).href;
              if (ok(abs) && !isProxied(abs)) {

                Object.defineProperty(a, 'href', {
                  get: () => pxy(abs), configurable: true, writable: true,
                });
              }
            } catch {}
          }
        }
      }
      return _dispatchEvent.call(this, e);
    };

    const patchRouter = (router) => {
      if (!router) return;
      ['push','replace','navigate'].forEach(method => {
        if (!router[method]) return;
        const orig = router[method].bind(router);
        router[method] = (url, ...args) => {
          if (typeof url === 'string' && ok(url)) url = pxy(new NativeURL(url, BASE).href);
          return orig(url, ...args);
        };
      });
    };

    if (G.__NEXT_DATA__) {
      try {
        const nData = G.__NEXT_DATA__;
        if (nData.assetPrefix && ok(nData.assetPrefix)) {
          nData.assetPrefix = pxy(new NativeURL(nData.assetPrefix, BASE).href);
        }
      } catch {}
    }

    ['__next_router__','__nuxt_router__','__app_router__'].forEach(key => {
      let val = G[key];
      try {
        Object.defineProperty(G, key, {
          get: () => val,
          set(v) { val = v; patchRouter(v); },
          configurable: true,
        });
        if (val) patchRouter(val);
      } catch {}
    });

    let wpPublicPath = '';
    try {
      if (G.__webpack_require__) {
        const orig = G.__webpack_require__.p;
        if (orig && ok(orig)) {
          G.__webpack_require__.p = pxy(new NativeURL(orig, BASE).href);
        }
        Object.defineProperty(G.__webpack_require__, 'p', {
          get: () => wpPublicPath,
          set: v => {
            wpPublicPath = (v && ok(v)) ? pxy(new NativeURL(v, BASE).href) : v;
          },
          configurable: true,
        });
      }
    } catch {}

    const importMap = document.querySelector('script[type="importmap"]');
    if (importMap) {
      try {
        const map = JSON.parse(importMap.textContent);
        if (map.imports) {
          for (const [key, url] of Object.entries(map.imports)) {
            if (ok(url)) map.imports[key] = pxy(new NativeURL(url, BASE).href);
          }
          importMap.textContent = JSON.stringify(map);
        }
      } catch {}
    }

    const lazyAttrs = ['data-src','data-lazy','data-original','data-srcset',
                       'data-bg','data-background','data-img-src'];

    const lazyObs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          const el = m.target;
          const attr = m.attributeName;
          if (lazyAttrs.includes(attr)) {
            const v = el.getAttribute(attr);
            if (v && ok(v)) {
              try { el.setAttribute(attr, pxy(new NativeURL(v, BASE).href)); } catch {}
            }
          }
        }
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          lazyAttrs.forEach(attr => {
            const v = node.getAttribute && node.getAttribute(attr);
            if (v && ok(v)) {
              try { node.setAttribute(attr, pxy(new NativeURL(v, BASE).href)); } catch {}
            }
          });
        });
      }
    });
    try {
      lazyObs.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: lazyAttrs,
      });
    } catch {}

    document.querySelectorAll('link[rel="prefetch"],link[rel="preload"],link[rel="modulepreload"]')
      .forEach(link => {
        const v = link.getAttribute('href');
        if (v && ok(v)) {
          try { link.setAttribute('href', pxy(new NativeURL(v, BASE).href)); } catch {}
        }
      });

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);