(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const { toProxyUrl, isProxied, BASE } = G.Celestial;
    if (!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const NativeFetch=G.__NativeFetch__||fetch;

    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};
    const ok=url=>{
      if(!url||typeof url!=='string') return false;
      url=url.trim();
      if(!url||/^(data:|blob:|javascript:|#|\s*$)/.test(url)) return false;
      try{return !isProxied(new NativeURL(url,BASE).href);}catch{return false;}
    };

    const inFlight=new Map();

    G.fetch=async(input,init={})=>{
      try{
        let url=typeof input==='string'?input:input instanceof Request?input.url:String(input);
        const abs=new NativeURL(url,BASE).href;
        if(!ok(abs)) return NativeFetch(input,init);
        const proxied=pxy(abs);
        const method=(init.method||'GET').toUpperCase();
        const newInit={credentials:'include',...init};
        if(newInit.mode==='no-cors') newInit.mode='cors';

        if(method==='GET'){
          const key=proxied;
          if(inFlight.has(key)) return inFlight.get(key);
          const p=NativeFetch(typeof input==='string'?proxied:new Request(proxied,input),newInit).finally(()=>inFlight.delete(key));
          inFlight.set(key,p);
          return p;
        }
        return NativeFetch(typeof input==='string'?proxied:new Request(proxied,input),newInit);
      }catch{return NativeFetch(input,init);}
    };

    const _XHR=G.XMLHttpRequest;
    G.XMLHttpRequest=class CXHR extends _XHR{
      constructor(){super();this.withCredentials=true;}
      open(method,url,...rest){
        try{if(ok(url))url=pxy(new NativeURL(url,BASE).href);}catch{}
        super.open(method,url,...rest);
      }
      get responseURL(){
        const raw=super.responseURL;
        if(raw&&G.Celestial&&G.Celestial.PREFIX&&raw.includes(G.Celestial.PREFIX)){
          try{const d=G.Celestial.dec&&G.Celestial.dec(new NativeURL(raw).pathname.slice(G.Celestial.PREFIX.length));if(d)return d;}catch{}
        }
        return raw;
      }
    };

    if(navigator.sendBeacon){
      const _sb=navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon=(url,data)=>{try{if(ok(url))url=pxy(new NativeURL(url,BASE).href);}catch{}return _sb(url,data);};
    }

    if(G.WebSocket){
      const _WS=G.WebSocket;
      G.WebSocket=class CWS extends _WS{
        constructor(url,protocols){
          try{const u=new NativeURL(url,BASE);if(u.protocol==='ws:'&&new NativeURL(BASE).protocol==='https:')u.protocol='wss:';url=u.href;}catch{}
          super(url,protocols);
        }
      };
      Object.assign(G.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});
    }

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);