(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<100&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE,PREFIX}=G.Celestial; if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    let currentBase=BASE;
    const pxy=url=>{
      try{
        const abs=new NativeURL(url,currentBase).href;
        return isProxied(abs)?abs:toProxyUrl(abs);
      }catch{return url;}
    };
    const _push=history.pushState.bind(history);
    const _rep=history.replaceState.bind(history);
    history.pushState=(s,t,u)=>{
      if(u){try{const abs=new NativeURL(u,currentBase).href;currentBase=abs;u=isProxied(abs)?abs:toProxyUrl(abs);}catch{}}
      _push(s,t,u);
    };
    history.replaceState=(s,t,u)=>{
      if(u){try{const abs=new NativeURL(u,currentBase).href;currentBase=abs;u=isProxied(abs)?abs:toProxyUrl(abs);}catch{}}
      _rep(s,t,u);
    };
    G.addEventListener('popstate',()=>{
      try{
        const path=new NativeURL(G.location.href).pathname;
        if(path.startsWith(PREFIX)){const d=G.Celestial.dec&&G.Celestial.dec(path.slice(PREFIX.length));if(d)currentBase=d;}
      }catch{}
    });
    G.Celestial.getCurrentBase=()=>currentBase;
    G.Celestial.setCurrentBase=u=>{currentBase=u;};

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);