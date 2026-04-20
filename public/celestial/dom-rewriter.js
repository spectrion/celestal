(function(G) {
  'use strict';
  const poll = (fn,n) => G.Celestial&&G.Celestial.BASE ? fn() : n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(() => {
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;
    const NativeURL = G.__NativeURL__ || URL;

    const pxy = url => { try { return toProxyUrl(new NativeURL(url,BASE).href); } catch { return url; } };
    const ok  = url => {
      if (!url || typeof url !== 'string') return false;
      url = url.trim();
      if (!url) return false;
      if (/^(javascript:|data:|blob:|#|mailto:|tel:)/.test(url)) return false;
      try { return !isProxied(new NativeURL(url,BASE).href); } catch { return false; }
    };

    function patchProp(proto, prop) {
      if (!proto) return;
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d||!d.set) return;
      try {
        Object.defineProperty(proto, prop, {
          get: d.get,
          set(v) { d.set.call(this, ok(v) ? pxy(v) : v); },
          configurable: true,
        });
      } catch {}
    }
    [HTMLImageElement,HTMLScriptElement,HTMLIFrameElement,HTMLAudioElement,
     HTMLVideoElement,HTMLSourceElement,HTMLTrackElement,HTMLInputElement,HTMLEmbedElement]
      .filter(Boolean).forEach(C => patchProp(C.prototype,'src'));
    [HTMLAnchorElement,HTMLAreaElement,HTMLLinkElement]
      .filter(Boolean).forEach(C => patchProp(C.prototype,'href'));
    if (HTMLFormElement)   patchProp(HTMLFormElement.prototype,'action');
    if (HTMLObjectElement) patchProp(HTMLObjectElement.prototype,'data');
    if (HTMLVideoElement)  patchProp(HTMLVideoElement.prototype,'poster');

    [HTMLImageElement,HTMLSourceElement].filter(Boolean).forEach(C => {
      const d = Object.getOwnPropertyDescriptor(C.prototype,'srcset');
      if (!d||!d.set) return;
      Object.defineProperty(C.prototype,'srcset',{
        get:d.get,
        set(v) { if(v) v=v.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,desc)=>(ok(u)?pxy(u):u)+(desc||'')); d.set.call(this,v); },
        configurable:true,
      });
    });

    const URL_ATTRS = new Set([
      'src','href','action','formaction','poster','data',
      'data-src','data-href','data-lazy','data-original','data-url','data-bg',
      'data-image','data-video','data-thumb','data-full','data-link',
      'data-target','data-expanded-url','data-redirect','data-poster',
    ]);
    const _setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      const n = (name||'').toLowerCase();
      if (n==='integrity'||n==='crossorigin') return; // strip SRI/CORS
      if (typeof value==='string') {
        if (n==='srcset') {
          value = value.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>(ok(u)?pxy(u):u)+(d||''));
        } else if (URL_ATTRS.has(n)&&ok(value)) {
          value = pxy(value);
        }
      }
      return _setAttr.call(this,name,value);
    };
    const _setAttrNS = Element.prototype.setAttributeNS;
    Element.prototype.setAttributeNS = function(ns,name,value) {
      const local=(name||'').split(':').pop().toLowerCase();
      if (URL_ATTRS.has(local)&&ok(value)) value=pxy(value);
      return _setAttrNS.call(this,ns,name,value);
    };

    const rwHTML = html => {
      if (!html||typeof html!=='string') return html;
      if (!/\b(?:src|href|action|srcset)\s*=/i.test(html)) return html;
      return html
        .replace(/(\b(?:src|href|action|formaction|poster|data|data-src|data-href|data-lazy|data-original|data-url|data-target)\s*=\s*)(["'])([^"'<>]*)\2/gi,
          (m,a,q,v)=>ok(v.trim())?(a+q+pxy(v.trim())+q):m)
        .replace(/(\bsrcset\s*=\s*)(["'])([^"'<>]*)\2/gi,(m,pre,q,set)=>
          pre+q+set.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>(ok(u)?pxy(u):u)+(d||''))+q);
    };
    const iHTMLd = Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if (iHTMLd&&iHTMLd.set) Object.defineProperty(Element.prototype,'innerHTML',{get:iHTMLd.get,set(v){iHTMLd.set.call(this,rwHTML(v));},configurable:true});
    const oHTMLd = Object.getOwnPropertyDescriptor(Element.prototype,'outerHTML');
    if (oHTMLd&&oHTMLd.set) Object.defineProperty(Element.prototype,'outerHTML',{get:oHTMLd.get,set(v){oHTMLd.set.call(this,rwHTML(v));},configurable:true});
    const _iah = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function(pos,html){ return _iah.call(this,pos,rwHTML(html)); };

    const _dw=document.write.bind(document), _dwl=document.writeln.bind(document);
    document.write   = (...a) => _dw(a.map(rwHTML).join(''));
    document.writeln = (...a) => _dwl(a.map(rwHTML).join(''));

    const _DP = G.DOMParser;
    G.DOMParser = class CDP extends _DP {
      parseFromString(str,type) { return super.parseFromString(typeof str==='string'&&/text\/html/i.test(type)?rwHTML(str):str,type); }
    };

    function patchNode(el) {
      if (!el||el.nodeType!==1) return;
      for (const a of ['src','href','action','poster','data']) {
        const v=el.getAttribute&&el.getAttribute(a);
        if(v&&ok(v)) try{_setAttr.call(el,a,pxy(v));}catch{}
      }
      const ss=el.getAttribute&&el.getAttribute('srcset');
      if(ss){const rw=ss.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>(ok(u)?pxy(u):u)+(d||''));if(rw!==ss)try{_setAttr.call(el,'srcset',rw);}catch{}}
    }
    const _ac=Node.prototype.appendChild, _ib=Node.prototype.insertBefore, _rc=Node.prototype.replaceChild;
    Node.prototype.appendChild    = function(n){if(n&&n.nodeType===1)patchNode(n);return _ac.call(this,n);};
    Node.prototype.insertBefore   = function(n,r){if(n&&n.nodeType===1)patchNode(n);return _ib.call(this,n,r);};
    Node.prototype.replaceChild   = function(n,o){if(n&&n.nodeType===1)patchNode(n);return _rc.call(this,n,o);};
    ['prepend','append','replaceWith','after','before'].forEach(m=>{
      const orig=Element.prototype[m]; if(!orig) return;
      Element.prototype[m]=function(...args){args.forEach(a=>{if(a&&a.nodeType===1)patchNode(a);});return orig.apply(this,args);};
    });

    const rwCSS = css => css.replace(/url\(\s*(["']?)((?!data:|blob:)[^)'"]*)\1\s*\)/gi,(m,q,u)=>{u=u.trim();if(!u||!ok(u))return m;try{return`url(${q}${pxy(u)}${q})`;}catch{return m;}});
    if (CSSStyleSheet) {
      const _ir=CSSStyleSheet.prototype.insertRule;
      if(_ir) CSSStyleSheet.prototype.insertRule=function(r,i){return _ir.call(this,rwCSS(r),i);};
      const _rep=CSSStyleSheet.prototype.replace;
      if(_rep) CSSStyleSheet.prototype.replace=function(t){return _rep.call(this,rwCSS(t));};
      const _repS=CSSStyleSheet.prototype.replaceSync;
      if(_repS) CSSStyleSheet.prototype.replaceSync=function(t){_repS.call(this,rwCSS(t));};
    }

    if (G.CSSStyleDeclaration) {
      const _sp=CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty=function(p,v,pri){
        if(typeof v==='string'&&/url\(/.test(v))v=rwCSS(v);return _sp.call(this,p,v,pri);
      };
      ['backgroundImage','background','borderImage','maskImage','WebkitMaskImage','content'].forEach(prop=>{
        const d=Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,prop);
        if(!d||!d.set) return;
        Object.defineProperty(CSSStyleDeclaration.prototype,prop,{
          get:d.get, set(v){if(typeof v==='string'&&/url\(/.test(v))v=rwCSS(v);d.set.call(this,v);}, configurable:true,
        });
      });
    }

    if(G.Worker){const _W=G.Worker;G.Worker=class CW extends _W{constructor(u,o){try{if(ok(u))u=pxy(u);}catch{}super(u,o);}}}
    if(G.EventSource){const _ES=G.EventSource;G.EventSource=class CES extends _ES{constructor(u,o){try{if(ok(u))u=pxy(u);}catch{}super(u,o);}}}

    const WATCHED=['src','href','action','formaction','poster','srcset','data','style','integrity','crossorigin'];
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type==='childList') {
          m.addedNodes.forEach(n=>{
            if(n.nodeType!==1) return;
            patchNode(n);
            n.querySelectorAll&&n.querySelectorAll('[src],[href],[action],[poster],[srcset]').forEach(patchNode);
          });
        } else if (m.type==='attributes') {
          const n=m.attributeName;
          if(n==='integrity'||n==='crossorigin'){try{m.target.removeAttribute(n);}catch{}}
          else if(URL_ATTRS.has(n)){const v=m.target.getAttribute&&m.target.getAttribute(n);if(v&&ok(v))try{_setAttr.call(m.target,n,pxy(v));}catch{}}
        }
      }
    }).observe(document.documentElement||document,{childList:true,subtree:true,attributes:true,attributeFilter:WATCHED});

  }, 0);
})(typeof globalThis!=='undefined'?globalThis:window);