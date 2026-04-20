(function(G) {
  'use strict';

  const _ce=document.createElement.bind(document);
  document.createElement=function(tag,...args){
    const el=_ce(tag,...args);
    if((tag||'').toLowerCase()==='meta'){
      const _sa=el.setAttribute.bind(el);
      el.setAttribute=(n,v)=>{ if((n||'').toLowerCase()==='http-equiv'&&(v||'').toLowerCase().includes('content-security-policy'))return; return _sa(n,v); };
    }
    return el;
  };

  document.addEventListener('securitypolicyviolation',e=>{e.stopImmediatePropagation();e.preventDefault();},true);

  new MutationObserver(muts=>{
    muts.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeName==='META'){
        const he=(n.getAttribute('http-equiv')||'').toLowerCase();
        if(he.includes('content-security-policy')||he.includes('x-frame-options')){
          try{n.parentNode.removeChild(n);}catch{}
        }
      }
    }));
  }).observe(document.documentElement||document,{childList:true,subtree:true});
  if(G.ReportingObserver){const _RO=G.ReportingObserver;G.ReportingObserver=class FRO extends _RO{constructor(cb,o){super((r,obs)=>{const f=r.filter(x=>x.type!=='csp-violation');if(f.length)cb(f,obs);},o);}}}
})(typeof globalThis!=='undefined'?globalThis:window);