(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE}=G.Celestial;
    if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};
    const ok=url=>{
      if(!url||typeof url!=='string')return false;
      url=url.trim();
      if(!url||/^(javascript:|data:|blob:|#|mailto:|tel:|\s*$)/.test(url))return false;
      try{return !isProxied(new NativeURL(url,BASE).href);}catch{return false;}
    };

    G.Celestial.rewriteHTML = function(html) {
      if (!html || typeof html !== 'string') return html;
      return html
        .replace(/(\b(?:src|href|action|formaction|poster|data|data-src|data-href|data-lazy|data-original|data-url|data-bg|data-image|data-target|data-expanded-url|data-background|data-cover)\s*=\s*)(["'])([^"'<>]*)\2/gi,
          (m,a,q,v)=>ok(v.trim())?(a+q+pxy(v.trim())+q):m)
        .replace(/(\bsrcset\s*=\s*)(["'])([^"'<>]*)\2/gi,(m,pre,q,set)=>
          pre+q+set.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>(ok(u)?pxy(u):u)+(d||''))+q);
    };

    G.Celestial.rewriteCSS = function(css) {
      if (!css || typeof css !== 'string') return css;
      return css.replace(/url\(\s*(["']?)((?!data:|blob:)[^)'"]*)\1\s*\)/gi,(m,q,u)=>{
        u=u.trim();if(!u||!ok(u))return m;try{return`url(${q}${pxy(u)}${q})`;}catch{return m;}
      });
    };

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);