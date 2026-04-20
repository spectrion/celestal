(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<100&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE}=G.Celestial; if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};
    const ok=url=>{
      if(!url||typeof url!=='string') return false;
      url=url.trim();
      if(!url||/^(javascript:|data:|blob:|#|mailto:|tel:)/.test(url)) return false;
      try{return !isProxied(new NativeURL(url,BASE).href);}catch{return false;}
    };
    function patchProp(proto,prop){
      if(!proto) return;
      const d=Object.getOwnPropertyDescriptor(proto,prop);
      if(!d||!d.set) return;
      try{Object.defineProperty(proto,prop,{get:d.get,set(v){d.set.call(this,ok(v)?pxy(v):v);},configurable:true});}catch{}
    }

    [HTMLImageElement,HTMLScriptElement,HTMLIFrameElement,HTMLAudioElement,
     HTMLVideoElement,HTMLSourceElement,HTMLTrackElement,HTMLInputElement,HTMLEmbedElement]
      .filter(Boolean).forEach(C=>patchProp(C.prototype,'src'));

    [HTMLAnchorElement,HTMLAreaElement,HTMLLinkElement].filter(Boolean).forEach(C=>patchProp(C.prototype,'href'));

    if(HTMLFormElement)   patchProp(HTMLFormElement.prototype,'action');
    if(HTMLObjectElement) patchProp(HTMLObjectElement.prototype,'data');
    if(HTMLVideoElement)  patchProp(HTMLVideoElement.prototype,'poster');

    [HTMLImageElement,HTMLSourceElement].filter(Boolean).forEach(C=>{
      const d=Object.getOwnPropertyDescriptor(C.prototype,'srcset');
      if(!d||!d.set) return;
      Object.defineProperty(C.prototype,'srcset',{get:d.get,
        set(v){if(v)v=v.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,desc)=>(ok(u)?pxy(u):u)+(desc||''));d.set.call(this,v);},configurable:true});
    });

    const _clone=Node.prototype.cloneNode;
    Node.prototype.cloneNode=function(deep){
      const c=_clone.call(this,deep);
      if(c&&c.nodeType===1) rewriteEl(c,deep);
      return c;
    };
    function rewriteEl(el,deep){
      if(!el||el.nodeType!==1) return;
      for(const a of ['src','href','action','poster','data']){
        const v=el.getAttribute&&el.getAttribute(a);
        if(v&&ok(v)) try{el.setAttribute(a,pxy(v));}catch{}
      }
      const ss=el.getAttribute&&el.getAttribute('srcset');
      if(ss){const rw=ss.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>(ok(u)?pxy(u):u)+(d||''));if(rw!==ss)try{el.setAttribute('srcset',rw);}catch{}}
      if(deep&&el.children) Array.from(el.children).forEach(c=>rewriteEl(c,true));
    }

    const _ac=Node.prototype.appendChild,_ib=Node.prototype.insertBefore,_rc=Node.prototype.replaceChild;
    Node.prototype.appendChild=(function(n){if(n&&n.nodeType===1)rewriteEl(n,false);return _ac.call(this,n);});
    Node.prototype.insertBefore=(function(n,r){if(n&&n.nodeType===1)rewriteEl(n,false);return _ib.call(this,n,r);});
    Node.prototype.replaceChild=(function(n,o){if(n&&n.nodeType===1)rewriteEl(n,false);return _rc.call(this,n,o);});

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);