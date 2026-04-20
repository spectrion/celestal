(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n<60 && setTimeout(()=>poll(fn,(n||0)+1),50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;

    const NativeURL = G.__NativeURL__ || URL;
    const pxy = url => { try { return toProxyUrl(new NativeURL(url, BASE).href); } catch { return url; } };
    const ok  = url => url && typeof url === 'string' && !isProxied(url)
                    && !/^(data:|blob:|javascript:|#|mailto:|tel:|\s*$)/.test(url.trim());

    let baseHostname = '';
    try { baseHostname = new NativeURL(BASE).hostname; } catch {}

    const isGoogle  = baseHostname.includes('google.');
    const isBing    = baseHostname.includes('bing.com');
    const isYahoo   = baseHostname.includes('yahoo.com');
    const isDDG     = baseHostname.includes('duckduckgo.com');
    const isBrave   = baseHostname.includes('search.brave.com');

    if (!isGoogle && !isBing && !isYahoo && !isDDG && !isBrave) return;

    if (isGoogle) {
      function unwrapGoogleLinks() {
        document.querySelectorAll('a[href*="/url?"], a[href*="&url="], a[data-href]').forEach(a => {
          let href = a.getAttribute('href') || '';

          const qMatch = href.match(/[?&](?:q|url)=(https?[^&]+)/);
          if (qMatch) {
            try {
              const real = decodeURIComponent(qMatch[1]);
              a.setAttribute('href', pxy(real));
              a.setAttribute('data-celestial-unwrapped', '1');
              return;
            } catch {}
          }

          const dataHref = a.getAttribute('data-href');
          if (dataHref && ok(dataHref)) {
            a.setAttribute('href', pxy(dataHref));
          }
        });

        document.querySelectorAll('img[data-src], img[data-iurl]').forEach(img => {
          const src = img.getAttribute('data-src') || img.getAttribute('data-iurl');
          if (src && ok(src)) {
            try { img.src = pxy(src); } catch {}
          }
        });

        document.querySelectorAll('a[href^="http"]').forEach(a => {
          const href = a.getAttribute('href');
          if (href && ok(href) && !isProxied(href)) {
            a.setAttribute('href', pxy(href));
          }
        });
      }

      unwrapGoogleLinks();
      const mo = new MutationObserver(() => unwrapGoogleLinks());
      mo.observe(document.body || document.documentElement, { childList:true, subtree:true });

      document.addEventListener('click', e => {
        const a = e.target && e.target.closest('a[href]');
        if (!a) return;
        let href = a.getAttribute('href');
        if (!href) return;

        const qMatch = href.match(/[?&](?:q|url)=(https?[^&]+)/);
        if (qMatch) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            const real = decodeURIComponent(qMatch[1]);
            G.location.href = pxy(real);
          } catch {}
          return;
        }
      }, true);
    }

    if (isBing) {
      function unwrapBingLinks() {
        document.querySelectorAll('a[href*="bing.com/ck/"], a[href*="/aclk?"], h2 a, .b_algo a').forEach(a => {
          const href = a.getAttribute('href') || '';

          const uMatch = href.match(/[?&]u=(a1[^&]+)/);
          if (uMatch) {
            try {

              const decoded = atob(uMatch[1].slice(2).replace(/-/g,'+').replace(/_/g,'/'));
              if (/^https?:\/\//.test(decoded)) {
                a.setAttribute('href', pxy(decoded));
                return;
              }
            } catch {}
          }
          const dataHref = a.getAttribute('data-href');
          if (dataHref && ok(dataHref)) a.setAttribute('href', pxy(dataHref));
        });
      }
      unwrapBingLinks();
      new MutationObserver(unwrapBingLinks).observe(document.body || document.documentElement, { childList:true, subtree:true });
    }

    if (isYahoo) {
      function unwrapYahooLinks() {
        document.querySelectorAll('a[href*="/RU="], a[href*="r.search.yahoo.com"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const ruMatch = href.match(/\/RU=([^/]+)\//);
          if (ruMatch) {
            try {
              const real = decodeURIComponent(ruMatch[1]);
              if (/^https?:\/\//.test(real)) a.setAttribute('href', pxy(real));
            } catch {}
          }
        });
      }
      unwrapYahooLinks();
      new MutationObserver(unwrapYahooLinks).observe(document.body || document.documentElement, { childList:true, subtree:true });
    }

    if (isDDG) {
      function unwrapDDGLinks() {
        document.querySelectorAll('a[href*="//duckduckgo.com/l/"], a.result__a, a[data-href]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const uddgMatch = href.match(/uddg=(https?[^&]+)/);
          if (uddgMatch) {
            try {
              const real = decodeURIComponent(uddgMatch[1]);
              a.setAttribute('href', pxy(real));
              return;
            } catch {}
          }
          const dataHref = a.getAttribute('data-href');
          if (dataHref && ok(dataHref)) a.setAttribute('href', pxy(dataHref));
        });
      }
      unwrapDDGLinks();
      new MutationObserver(unwrapDDGLinks).observe(document.body || document.documentElement, { childList:true, subtree:true });
    }

    document.addEventListener('click', e => {
      const btn = e.target && (
        e.target.closest('[role="button"][data-href]') ||
        e.target.closest('[data-url]') ||
        e.target.closest('[data-target-url]')
      );
      if (!btn) return;
      const url = btn.getAttribute('data-href') || btn.getAttribute('data-url') || btn.getAttribute('data-target-url');
      if (url && ok(url)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        G.location.href = pxy(url);
      }
    }, true);

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);