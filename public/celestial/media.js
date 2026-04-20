(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n<60 && setTimeout(()=>poll(fn,(n||0)+1),50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;

    const NativeURL = G.__NativeURL__ || URL;
    const STREAM    = '/.netlify/functions/stream';

    const pxy = url => { try { return toProxyUrl(new NativeURL(url,BASE).href); } catch { return url; } };
    const streamPxy = url => { try { return STREAM+'?url='+encodeURIComponent(new NativeURL(url,BASE).href); } catch { return url; } };
    const ok  = url => url && typeof url === 'string' && !isProxied(url) && !/^(data:|blob:|javascript:)/.test(url.trim());

    ['HTMLVideoElement','HTMLAudioElement','HTMLMediaElement'].forEach(name => {
      const C = G[name]; if (!C) return;
      const d = Object.getOwnPropertyDescriptor(C.prototype, 'src');
      if (d && d.set) {
        Object.defineProperty(C.prototype, 'src', {
          get: d.get,
          set(v) {
            if (v && ok(v)) {

              if (/\.m3u8|\.mpd|m3u8|mpd/.test(v)) {
                v = streamPxy(v);
              } else {
                v = pxy(v);
              }
            }
            d.set.call(this, v);
          },
          configurable: true,
        });
      }

      const cs = Object.getOwnPropertyDescriptor(C.prototype, 'currentSrc');
      if (cs && cs.get) {
        Object.defineProperty(C.prototype, 'currentSrc', {
          get() {
            const raw = cs.get.call(this);
            if (raw && G.Celestial) {
              try {
                const PREFIX = G.Celestial.PREFIX;
                if (raw.includes(PREFIX)) {
                  const dec = G.Celestial.dec && G.Celestial.dec(new NativeURL(raw).pathname.slice(PREFIX.length));
                  if (dec) return dec;
                }
              } catch {}
            }
            return raw;
          },
          configurable: true,
        });
      }
    });

    if (G.HTMLVideoElement) {
      const d = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'poster');
      if (d && d.set) Object.defineProperty(HTMLVideoElement.prototype, 'poster', {
        get: d.get, set(v) { if(ok(v)) v=pxy(v); d.set.call(this,v); }, configurable:true,
      });
    }

    const _fetch = G.fetch && G.fetch.bind ? G.fetch.bind(G) : fetch;
    G.fetch = (input, init) => {
      try {
        const url = typeof input==='string' ? input : input instanceof Request ? input.url : String(input);
        const abs = new NativeURL(url, BASE).href;
        if (ok(abs) && /\.m3u8|\.mpd|\.ts\b|\.cmaf|segment/.test(abs)) {
          const proxied = /\.m3u8|\.mpd/.test(abs) ? streamPxy(abs) : pxy(abs);
          return _fetch(typeof input==='string' ? proxied : new Request(proxied, input), init);
        }
      } catch {}
      return _fetch(input, init);
    };

    if (typeof CanvasRenderingContext2D !== 'undefined') {
      const _gid = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x,y,w,h) {
        const d = _gid.call(this,x,y,w,h);
        if (d.data.length > 4) d.data[d.data.length-1] ^= 1;
        return d;
      };
    }

    if (typeof WebGLRenderingContext !== 'undefined') {
      const _gp = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(p) {
        if (p===37445) return 'Intel Inc.';
        if (p===37446) return 'Intel Iris OpenGL Engine';
        return _gp.call(this,p);
      };
    }

    if (G.RTCPeerConnection) {
      const _RTC = G.RTCPeerConnection;
      G.RTCPeerConnection = class CRTC extends _RTC {
        constructor(config,...rest) {
          super(config ? {...config, iceServers:[]} : {}, ...rest);
        }
      };
      ['RTCPeerConnection','webkitRTCPeerConnection','mozRTCPeerConnection']
        .forEach(n => { if(G[n]) G[n]=G.RTCPeerConnection; });
    }

    if (G.IntersectionObserver) {
      const _IO = G.IntersectionObserver;
      G.IntersectionObserver = class CIO extends _IO {
        constructor(cb, opts) {
          super((entries, obs) => {
            cb(entries, obs);
            entries.forEach(e => {
              if (!e.isIntersecting) return;
              const el = e.target;
              for (const attr of ['data-src','data-lazy','data-original']) {
                const v = el.getAttribute && el.getAttribute(attr);
                if (v && ok(v)) try { el.setAttribute('src', pxy(v)); break; } catch {}
              }
            });
          }, opts);
        }
      };
    }

    if (HTMLVideoElement && HTMLVideoElement.prototype.requestPictureInPicture) {
      HTMLVideoElement.prototype.requestPictureInPicture = () =>
        Promise.reject(new DOMException('Not allowed','NotAllowedError'));
    }

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);