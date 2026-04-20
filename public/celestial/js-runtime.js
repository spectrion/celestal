(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const { toProxyUrl, isProxied, BASE, PREFIX } = G.Celestial;
    if (!BASE) return;
    const NativeURL=G.__NativeURL__||URL;

    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};
    const ok=url=>url&&typeof url==='string'&&!isProxied(url)&&!/^(javascript:|data:|blob:|#|\s*$)/.test(url.trim());

    try{
      class CelestialURL extends NativeURL{
        constructor(url,base){
          if(!base||base===G.location.href) base=BASE;
          else if(typeof base==='string'&&base.includes(PREFIX)){
            try{const d=G.Celestial.dec&&G.Celestial.dec(new NativeURL(base).pathname.slice(PREFIX.length));if(d)base=d;}catch{}
          }
          super(url,base);
        }
      }
      CelestialURL.createObjectURL=NativeURL.createObjectURL&&NativeURL.createObjectURL.bind(NativeURL);
      CelestialURL.revokeObjectURL=NativeURL.revokeObjectURL&&NativeURL.revokeObjectURL.bind(NativeURL);
      if(NativeURL.canParse) CelestialURL.canParse=NativeURL.canParse.bind(NativeURL);
      G.URL=CelestialURL;
    }catch{}

    const xhrD=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,'responseURL');
    if(xhrD&&xhrD.get) Object.defineProperty(XMLHttpRequest.prototype,'responseURL',{
      get(){const r=xhrD.get.call(this);if(r&&r.includes(PREFIX)){try{const d=G.Celestial.dec&&G.Celestial.dec(new NativeURL(r).pathname.slice(PREFIX.length));if(d)return d;}catch{}}return r;},
      configurable:true,
    });

    if(G.trustedTypes&&G.trustedTypes.createPolicy){
      ['default','celestial#default','goog#html'].forEach(n=>{
        try{G.trustedTypes.createPolicy(n,{createHTML:s=>s,createScript:s=>s,createScriptURL:s=>ok(s)?pxy(s):s});}catch{}
      });
    }

    if(G.Sanitizer) G.Sanitizer=class FS{sanitize(){return document.createDocumentFragment();}sanitizeFor(e,h){return{toString:()=>h};}};

    const _pm=G.postMessage&&G.postMessage.bind(G);
    if(_pm) G.postMessage=(data,target,...rest)=>_pm(data,'*',...rest);

    const _def=Object.defineProperty.bind(Object);
    Object.defineProperty=(obj,prop,desc)=>{
      if((obj===G||obj===window)&&prop==='location') return obj;
      return _def(obj,prop,desc);
    };

    const _eval=G.eval;
    G.eval=function(code){
      if(typeof code==='string'&&/fetch\s*\(["'`]https?:\/\//.test(code)){
        code=code.replace(/(\bfetch\s*\(\s*)(["'`])(https?:\/\/[^"'`]+)\2/g,(m,f,q,url)=>{try{return f+q+pxy(url)+q;}catch{return m;}});
      }
      return _eval.call(G,code);
    };
    try{G.eval.toString=()=>'function eval() { [native code] }';}catch{}

    const _pn=performance.now.bind(performance);
    performance.now=()=>Math.round(_pn()*1000)/1000+Math.random()*0.005;

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);