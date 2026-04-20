(function(G) {
  'use strict';
  const poll = (fn, n) => G.Celestial && G.Celestial.BASE ? fn() : (n < 60 && setTimeout(() => poll(fn, (n||0)+1), 50));
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;

    const NativeURL = G.__NativeURL__ || URL;
    const pxy = url => { try { return toProxyUrl(new NativeURL(url, BASE).href); } catch { return url; } };
    const ok  = url => url && !isProxied(url) && !/^(data:|blob:)/.test(url.trim());

    function rewriteCSS(css) {
      if (!css || typeof css !== 'string') return css;

      css = css.replace(/url\(\s*(['"]?)((?!data:|blob:)[^)'"]*)\1\s*\)/gi, (m, q, u) => {
        u = u.trim(); if (!u || !ok(u)) return m;
        try { return `url(${q}${pxy(new NativeURL(u, BASE).href)}${q})`; } catch { return m; }
      });

      css = css.replace(/@import\s+(['"])(.*?)\1/gi, (m, q, u) => {
        try { return `@import ${q}${pxy(new NativeURL(u, BASE).href)}${q}`; } catch { return m; }
      });

      css = css.replace(/(@font-face\s*\{[^}]*src\s*:\s*)([^;]+)/gi, (m, pre, srcs) => {
        const rw = srcs.replace(/url\(\s*(['"]?)((?!data:)[^)'"]+)\1\s*\)/gi, (m, q, u) => {
          try { return `url(${q}${pxy(new NativeURL(u, BASE).href)}${q})`; } catch { return m; }
        });
        return pre + rw;
      });
      return css;
    }

    if (CSSStyleSheet && CSSStyleSheet.prototype) {
      const _ir = CSSStyleSheet.prototype.insertRule;
      CSSStyleSheet.prototype.insertRule = function(rule, idx) {
        try { rule = rewriteCSS(rule); } catch {}
        return _ir.call(this, rule, idx);
      };

      if (CSSStyleSheet.prototype.replace) {
        const _replace = CSSStyleSheet.prototype.replace;
        CSSStyleSheet.prototype.replace = function(text) { return _replace.call(this, rewriteCSS(text)); };
      }
      if (CSSStyleSheet.prototype.replaceSync) {
        const _replaceSync = CSSStyleSheet.prototype.replaceSync;
        CSSStyleSheet.prototype.replaceSync = function(text) { return _replaceSync.call(this, rewriteCSS(text)); };
      }
    }

    if (G.CSSStyleDeclaration) {
      const _sp = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function(prop, val, pri) {
        if (typeof val === 'string' && /url\(/.test(val)) val = rewriteCSS(val);
        return _sp.call(this, prop, val, pri);
      };

      const URL_PROPS = [
        'background','backgroundImage','borderImage','borderImageSource',
        'content','cursor','listStyleImage','mask','maskImage',
        'WebkitMask','WebkitMaskImage','offsetPath','clipPath',
        'shapeOutside','src', // @font-face src
      ];
      URL_PROPS.forEach(prop => {
        const d = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
        if (!d || !d.set) return;
        try {
          Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
            get: d.get,
            set(v) { if (typeof v==='string' && /url\(/.test(v)) v=rewriteCSS(v); d.set.call(this,v); },
            configurable: true,
          });
        } catch {}
      });
    }

    const _createTextNode = document.createTextNode.bind(document);
    document.createTextNode = function(data) {

      if (typeof data === 'string' && /url\(/.test(data)) {
        data = rewriteCSS(data);
      }
      return _createTextNode(data);
    };

    try {
      const _adoptedDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')
        || Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');
      if (_adoptedDesc && _adoptedDesc.set) {
        const _set = _adoptedDesc.set;
        const _get = _adoptedDesc.get;
        Object.defineProperty(Document.prototype, 'adoptedStyleSheets', {
          get: _get,
          set(sheets) {

            return _set.call(this, sheets);
          },
          configurable: true,
        });
      }
    } catch {}

    const styleWatcher = new MutationObserver(muts => {
      for (const m of muts) {

        m.addedNodes.forEach(node => {
          if (node.nodeName === 'STYLE' && node.textContent) {
            const rw = rewriteCSS(node.textContent);
            if (rw !== node.textContent) node.textContent = rw;
          }
        });

        if (m.type === 'characterData' && m.target.parentNode &&
            m.target.parentNode.nodeName === 'STYLE') {
          const rw = rewriteCSS(m.target.data);
          if (rw !== m.target.data) m.target.data = rw;
        }
      }
    });
    try {
      styleWatcher.observe(document.documentElement || document, {
        childList: true, subtree: true, characterData: true,
      });
    } catch {}

  }, 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);