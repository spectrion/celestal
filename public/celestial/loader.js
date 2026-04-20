(function(G) {
  'use strict';
  const MODULES = [
    '/celestial/csp.js',
    '/celestial/sandbox.js',
    '/celestial/element.js',
    '/celestial/dom-rewriter.js',
    '/celestial/style.js',
    '/celestial/fetch-hook.js',
    '/celestial/network.js',
    '/celestial/login.js',
    '/celestial/js-runtime.js',
    '/celestial/history.js',
    '/celestial/worker.js',
    '/celestial/storage.js',
    '/celestial/media.js',
    '/celestial/scope.js',
    '/celestial/navigator.js',
    '/celestial/yt.js',
    '/celestial/search.js',
    '/celestial/prefetch.js',
    '/celestial/error-handler.js',
  ];
  let idx = 0;
  function next() {
    if (idx >= MODULES.length) {
      try { G.dispatchEvent(new Event('celestial:ready')); } catch {}
      return;
    }
    const src = MODULES[idx++];
    const s = document.createElement('script');
    s.src = src;
    s.onload  = next;
    s.onerror = () => { console.warn('[Celestial] Failed:', src); next(); };
    (document.head || document.documentElement).appendChild(s);
  }
  if (G.__C_BASE__) next();
})(typeof globalThis !== 'undefined' ? globalThis : window);