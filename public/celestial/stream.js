(function(G) {
  'use strict';

  const poll = (fn, n) => G.Celestial && G.Celestial.BASE
    ? fn() : (n < 80 && setTimeout(() => poll(fn, (n||0)+1), 50));

  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;

    const NativeURL   = G.__NativeURL__  || URL;
    const NativeFetch = G.__NativeFetch__ || fetch;

    const pxy = url => { try { return toProxyUrl(new NativeURL(url, BASE).href); } catch { return url; } };
    const ok  = url => url && !isProxied(url) && !/^(data:|blob:|javascript:)/.test(url);

    const _fetch = G.fetch;
    G.fetch = async (input, init) => {
      let url = typeof input === 'string' ? input
        : input instanceof Request ? input.url : String(input);

      try {
        const abs = new NativeURL(url, BASE).href;
        if (!isProxied(abs) && ok(abs)) {

          const isMedia = /\.(m3u8|mpd|ts|m4s|mp4|m4v|m4a|aac|mp3|webm|ogg)(\?.*)?$/i.test(abs)
            || abs.includes('/seg') || abs.includes('/chunk') || abs.includes('/fragment');

          if (isMedia) {
            const mediaUrl = `/.netlify/functions/media?url=${encodeURIComponent(abs)}`;
            const newInit = Object.assign({}, init);
            return NativeFetch(mediaUrl, newInit);
          }

          url = toProxyUrl(abs);
        }
      } catch {}

      return _fetch(typeof input === 'string' ? url : new Request(url, input), init);
    };

    if (G.EventSource) {
      const _ES = G.EventSource;
      G.EventSource = class CelestialES extends _ES {
        constructor(url, opts) {
          try {
            const abs = new NativeURL(url, BASE).href;
            if (ok(abs)) url = pxy(abs);
          } catch {}
          super(url, opts);
        }
        get url() {
          const raw = super.url;
          if (raw && raw.includes('/celestial/')) {
            try {
              const enc = new NativeURL(raw).pathname.replace(/^\/celestial\//, '');
              const dec = G.Celestial.dec && G.Celestial.dec(enc);
              if (dec) return dec;
            } catch {}
          }
          return raw;
        }
      };
    }

    if (G.MediaSource) {
      const _isTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);
      MediaSource.isTypeSupported = function(mimeType) {

        if (/video\/(mp4|webm|ogg)|audio\/(mp4|webm|ogg|aac|mpeg)/i.test(mimeType)) {
          const supported = _isTypeSupported(mimeType);
          return supported;
        }
        return _isTypeSupported(mimeType);
      };
    }

    if (G.WebSocket) {
      const _WS = G.WebSocket;

      const _addEL = _WS.prototype.addEventListener;
      _WS.prototype.addEventListener = function(type, handler, opts) {
        if (type === 'message') {
          const wrapped = function(e) {
            let data = e.data;

            if (typeof data === 'string' && data.startsWith('{')) {
              try {
                const parsed = JSON.parse(data);
                const rewritten = rewriteObject(parsed);
                data = JSON.stringify(rewritten);
              } catch {}
            }
            if (data !== e.data) {
              const newE = new MessageEvent('message', {
                data, origin: e.origin, lastEventId: e.lastEventId,
                source: e.source, ports: [...e.ports],
              });
              return handler.call(this, newE);
            }
            return handler.call(this, e);
          };
          return _addEL.call(this, type, wrapped, opts);
        }
        return _addEL.call(this, type, handler, opts);
      };
    }

    function rewriteObject(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(rewriteObject);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && /^https?:\/\//.test(v) && ok(v)) {
          try { out[k] = pxy(v); } catch { out[k] = v; }
        } else if (typeof v === 'object') {
          out[k] = rewriteObject(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    }

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);