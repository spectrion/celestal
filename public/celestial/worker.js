(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n < 60 && setTimeout(() => poll(fn, (n||0)+1), 50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE, PREFIX } = G.Celestial;
    if (!BASE) return;

    const NativeURL = G.__NativeURL__ || URL;
    const pxy = url => { try { return toProxyUrl(new NativeURL(url, BASE).href); } catch { return url; } };
    const ok  = url => url && !isProxied(url) && !/^(data:|blob:)/.test(url);

    if (navigator.serviceWorker) {
      const _reg = navigator.serviceWorker.register.bind(navigator.serviceWorker);

      navigator.serviceWorker.register = async function(scriptURL, options={}) {
        try {

          const abs = new NativeURL(scriptURL, BASE).href;
          const proxiedScript = `/.netlify/functions/rewrite?url=${encodeURIComponent(abs)}&prefix=${encodeURIComponent(PREFIX)}&key=66`;

          let scope = options.scope;
          if (scope) {
            try { scope = pxy(new NativeURL(scope, BASE).href); } catch {}
          } else {
            scope = PREFIX;
          }
          return await _reg(proxiedScript, { ...options, scope });
        } catch {

          return { scope: PREFIX, active: null, installing: null, waiting: null,
            addEventListener: ()=>{}, removeEventListener: ()=>{}, update: ()=>Promise.resolve() };
        }
      };

      const _getRegs = navigator.serviceWorker.getRegistrations.bind(navigator.serviceWorker);
      navigator.serviceWorker.getRegistrations = () => _getRegs().then(regs => regs.filter(r => r.scope.includes(PREFIX)));

      navigator.serviceWorker.addEventListener('message', e => {

      });
    }

    const _Worker = G.Worker;
    if (_Worker) {
      G.Worker = class CelestialWorker extends _Worker {
        constructor(url, opts={}) {
          let workerUrl = url;
          try {
            const abs = new NativeURL(url, BASE).href;
            if (ok(abs)) {

              workerUrl = `/.netlify/functions/rewrite?url=${encodeURIComponent(abs)}&prefix=${encodeURIComponent(PREFIX)}&key=66`;
            }
          } catch {}
          super(workerUrl, opts);
        }
      };
      Object.assign(G.Worker, { prototype: _Worker.prototype });
    }

    if (G.SharedWorker) {
      const _SW = G.SharedWorker;
      G.SharedWorker = class CelestialSharedWorker extends _SW {
        constructor(url, opts) {
          try {
            const abs = new NativeURL(url, BASE).href;
            if (ok(abs)) url = `/.netlify/functions/rewrite?url=${encodeURIComponent(abs)}&prefix=${encodeURIComponent(PREFIX)}&key=66`;
          } catch {}
          super(url, opts);
        }
      };
    }

    if (typeof importScripts === 'function') {
      const _is = importScripts;
      self.importScripts = (...urls) => _is(...urls.map(u => {
        try {
          const abs = new NativeURL(u, BASE).href;
          return ok(abs) ? pxy(abs) : u;
        } catch { return u; }
      }));
    }

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);