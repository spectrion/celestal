(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<100&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {toProxyUrl,isProxied,BASE}=G.Celestial; if(!BASE) return;
    const NativeURL=G.__NativeURL__||URL;
    const ok=url=>{if(!url||typeof url!=='string')return false;url=url.trim();if(!url||/^(javascript:|data:|blob:|#|mailto:|tel:)/.test(url))return false;try{return !isProxied(new NativeURL(url,BASE).href);}catch{return false;}};
    const pxy=url=>{try{return toProxyUrl(new NativeURL(url,BASE).href);}catch{return url;}};

    document.addEventListener('submit',e=>{
      const form=e.target; if(!form||form.tagName.toLowerCase()!=='form') return;
      const action=form.getAttribute('action')||BASE;
      let abs; try{abs=new NativeURL(action,BASE).href;}catch{return;}
      if(isProxied(abs)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const method=(form.method||'get').toUpperCase();
      const fd=new FormData(form);
      if(method==='GET'){
        const dest=new NativeURL(abs);
        dest.search=new URLSearchParams(fd).toString();
        G.location.href=pxy(dest.href);
      } else {
        form.action=pxy(abs);

        const clone=form.cloneNode(true);
        clone.action=pxy(abs);
        clone.style.display='none';
        document.body.appendChild(clone);
        clone.submit();
        setTimeout(()=>clone.remove(),1000);
      }
    },true);

    const _open=G.open&&G.open.bind(G);
    if(_open) G.open=(url,...a)=>{
      try{if(url&&ok(url))url=pxy(new NativeURL(url,BASE).href);}catch{}
      return _open(url,...a);
    };

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);