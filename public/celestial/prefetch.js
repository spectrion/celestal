(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n<60 && setTimeout(()=>poll(fn,(n||0)+1),50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;
    const NativeURL = G.__NativeURL__ || URL;
    const prefetched = new Set();

    function prefetchUrl(url) {
      if (prefetched.has(url)) return;
      if (!url || isProxied(url) || /^(data:|blob:|javascript:|#|mailto:|tel:)/.test(url)) return;
      prefetched.add(url);
      try {
        const proxied = toProxyUrl(new NativeURL(url, BASE).href);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = proxied;
        link.as = 'document';
        document.head.appendChild(link);
      } catch {}
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const href = el.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          setTimeout(() => prefetchUrl(href), 100);
        }
      });
    }, { rootMargin: '200px' });

    function watchLinks() {
      document.querySelectorAll('a[href]').forEach(a => {
        if (!a.__celestialWatched) { a.__celestialWatched = true; io.observe(a); }
      });
    }

    watchLinks();
    const mo = new MutationObserver(() => watchLinks());
    mo.observe(document.documentElement, { childList:true, subtree:true });

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);