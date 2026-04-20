(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n<60 && setTimeout(()=>poll(fn,(n||0)+1),50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE, PREFIX } = G.Celestial;
    if (!BASE) return;

    const NativeURL   = G.__NativeURL__   || URL;
    const NativeFetch = G.__NativeFetch__ || fetch;

    const inFlight = new Map(); // url → Promise

    const _fetch = G.fetch;
    G.fetch = (input, init) => {
      try {
        const url = typeof input==='string' ? input : input instanceof Request ? input.url : String(input);
        const method = (init&&init.method||'GET').toUpperCase();

        if (method !== 'GET') return _fetch(input, init);

        const key = url;
        if (inFlight.has(key)) return inFlight.get(key);

        const promise = _fetch(input, init).finally(() => inFlight.delete(key));
        inFlight.set(key, promise);
        return promise;
      } catch { return _fetch(input, init); }
    };

    if ('loading' in HTMLImageElement.prototype) {

      const _setAttribute = Element.prototype.setAttribute;
      document.querySelectorAll('img[data-src],img[data-lazy]').forEach(img => {
        const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy');
        if (lazySrc) {
          img.loading = 'lazy';
          try {
            img.setAttribute('src', toProxyUrl(new NativeURL(lazySrc, BASE).href));
          } catch {}
        }
      });
    }

    const CDNS = [
      'fonts.googleapis.com','fonts.gstatic.com',
      'cdn.jsdelivr.net','unpkg.com',
      'ajax.googleapis.com','cdnjs.cloudflare.com',
    ];
    CDNS.forEach(cdn => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = '//' + cdn;
      document.head.appendChild(link);
    });

    if (typeof HTMLImageElement !== 'undefined' && HTMLImageElement.prototype.decode) {
      const _decodeImg = HTMLImageElement.prototype.decode;

      let decodeQueue = [];
      let decodeTimer = null;
      HTMLImageElement.prototype.decode = function() {
        return _decodeImg.call(this);
      };
    }

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);