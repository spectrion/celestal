(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {BASE}=G.Celestial; if(!BASE) return;
    let baseObj; try{baseObj=new URL(BASE);}catch{return;}
    const def=(o,p,v)=>{try{Object.defineProperty(o,p,{get:()=>v,configurable:true});}catch{}};

    try{
      const proxy=new Proxy(G,{get(t,p){if(p==='location')return G.location;if(p==='document')return document;if(p==='window'||p==='self'||p==='top'||p==='parent')return G;const v=t[p];return typeof v==='function'?v.bind(t):v;},set(t,p,v){t[p]=v;return true;}});
      def(G,'top',proxy); def(G,'parent',proxy); def(G,'frameElement',null);
    }catch{}
    try{def(document,'domain',baseObj.hostname);}catch{}

    try{document.hasFocus=()=>true;}catch{}
    try{def(document,'visibilityState','visible');def(document,'hidden',false);}catch{}
    document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);

    G.addEventListener('beforeunload',e=>e.stopImmediatePropagation(),true);

    G.addEventListener('error',e=>{if(e.filename&&e.filename.includes('/celestial/'))e.stopImmediatePropagation();},true);

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);