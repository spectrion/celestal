(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<100&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE}=G.Celestial; if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};
    const ok=url=>url&&typeof url==='string'&&!isProxied(url)&&/^https?:\/\//.test(url);

    const _eval=G.eval;
    G.eval=function(code){
      if(typeof code==='string'&&/https?:\/\//.test(code)){
        code=code.replace(/(["'`])(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+?)\1/g,(m,q,url)=>{
          if(!ok(url))return m;
          return q+pxy(url)+q;
        });
      }
      return _eval.call(G,code);
    };
    try{G.eval.toString=()=>'function eval() { [native code] }';}catch{}

    try{
      const _Fn=G.Function;
      G.Function=new Proxy(_Fn,{
        construct(T,args){
          const last=args[args.length-1];
          if(typeof last==='string'&&/https?:\/\//.test(last)){
            args=args.slice();
            args[args.length-1]=last.replace(/(["'`])(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+?)\1/g,(m,q,url)=>{
              if(!ok(url))return m;
              return q+pxy(url)+q;
            });
          }
          return new T(...args);
        },
        apply(T,self,args){return T.apply(self,args);}
      });
    }catch{}

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);