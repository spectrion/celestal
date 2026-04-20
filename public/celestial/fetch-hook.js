(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<100&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE}=G.Celestial; if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const ok=url=>{if(!url||typeof url!=='string')return false;url=url.trim();if(!url||/^(data:|blob:|javascript:|#)/.test(url))return false;try{return !isProxied(new NativeURL(url,BASE).href);}catch{return false;}};
    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};

    function getCSRF(){
      const selectors=['meta[name="csrf-token"]','meta[name="_token"]','meta[name="csrf_token"]',
        'input[name="_token"]','input[name="csrf_token"]','input[name="authenticity_token"]','input[name="_csrf"]'];
      for(const s of selectors){const el=document.querySelector(s);if(el)return el.getAttribute('content')||el.value;}
      const m=document.cookie.match(/(?:csrf[_-]?token|XSRF-TOKEN|csrftoken)=([^;]+)/i);
      return m?decodeURIComponent(m[1]):null;
    }

    const _f=G.fetch&&G.fetch.bind(G);
    if(_f) G.fetch=async(input,init={})=>{
      try{
        let url=typeof input==='string'?input:input instanceof Request?input.url:String(input);
        const abs=new NativeURL(url,BASE).href;
        if(!ok(abs)) return _f(input,init);
        const proxied=pxy(abs);
        const method=(init.method||'GET').toUpperCase();
        const newInit={credentials:'include',...init};
        if(newInit.mode==='no-cors') newInit.mode='cors';

        if(['POST','PUT','PATCH','DELETE'].includes(method)){
          const csrf=getCSRF();
          if(csrf){
            const h=new Headers(newInit.headers||{});
            if(!h.has('x-csrf-token')&&!h.has('x-xsrf-token')){h.set('x-csrf-token',csrf);h.set('x-xsrf-token',csrf);}
            newInit.headers=h;
          }
        }
        return _f(typeof input==='string'?proxied:new Request(proxied,input),newInit);
      }catch{return _f(input,init);}
    };

    const _XHR=G.XMLHttpRequest;
    G.XMLHttpRequest=class CXHR extends _XHR{
      constructor(){super();this.withCredentials=true;}
      open(method,url,...rest){
        try{if(ok(url))url=pxy(new NativeURL(url,BASE).href);}catch{}
        this.__m__=method;
        super.open(method,url,...rest);
      }
      send(body){
        if(['POST','PUT','PATCH','DELETE'].includes((this.__m__||'').toUpperCase())){
          const csrf=getCSRF();
          if(csrf){try{super.setRequestHeader('x-csrf-token',csrf);}catch{}try{super.setRequestHeader('x-xsrf-token',csrf);}catch{}}
        }
        super.send(body);
      }
    };

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);