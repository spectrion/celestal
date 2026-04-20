(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const {BASE}=G.Celestial; if(!BASE) return;
    let pageOrigin; try{pageOrigin=new URL(BASE).origin;}catch{return;}
    const NS='\u200b__c__'+btoa(pageOrigin).replace(/=/g,'')+'__';
    function makeProxy(real){
      const getKeys=()=>{const out=[];for(let i=0;i<real.length;i++){const k=real.key(i);if(k&&k.startsWith(NS))out.push(k.slice(NS.length));}return out;};
      return new Proxy({},{
        get(_,p){
          if(p==='length') return getKeys().length;
          if(p==='key')    return i=>getKeys()[i]??null;
          if(p==='getItem')    return k=>real.getItem(NS+k);
          if(p==='setItem')    return (k,v)=>real.setItem(NS+k,v);
          if(p==='removeItem') return k=>real.removeItem(NS+k);
          if(p==='clear')      return ()=>getKeys().forEach(k=>real.removeItem(NS+k));
          if(typeof p==='string'){const v=real.getItem(NS+p);return v!==null?v:undefined;}
          return undefined;
        },
        set(_,p,v){if(typeof p==='string')real.setItem(NS+p,v);return true;},
        deleteProperty(_,p){real.removeItem(NS+p);return true;},
        has(_,p){return real.getItem(NS+p)!==null;},
        ownKeys(){return getKeys();},
        getOwnPropertyDescriptor(_,k){const v=real.getItem(NS+k);return v!==null?{value:v,writable:true,enumerable:true,configurable:true}:undefined;},
      });
    }
    try{const _ls=G.localStorage,_ss=G.sessionStorage;Object.defineProperty(G,'localStorage',{get:()=>makeProxy(_ls),configurable:true});Object.defineProperty(G,'sessionStorage',{get:()=>makeProxy(_ss),configurable:true});}catch{}
    if(G.indexedDB){const _i=G.indexedDB,_o=_i.open.bind(_i),_d=_i.deleteDatabase.bind(_i);_i.open=(n,v)=>_o(NS+n,v);_i.deleteDatabase=n=>_d(NS+n);if(_i.databases){const _db=_i.databases.bind(_i);_i.databases=()=>_db().then(l=>l.filter(x=>x.name&&x.name.startsWith(NS)).map(x=>({...x,name:x.name.slice(NS.length)})));}}
    if(G.caches){const _c=G.caches,_o=_c.open.bind(_c),_d=_c.delete.bind(_c),_h=_c.has.bind(_c),_k=_c.keys.bind(_c);_c.open=n=>_o(NS+n);_c.delete=n=>_d(NS+n);_c.has=n=>_h(NS+n);_c.keys=()=>_k().then(k=>k.filter(n=>n.startsWith(NS)).map(n=>n.slice(NS.length)));}
    if(G.BroadcastChannel){const _BC=G.BroadcastChannel;G.BroadcastChannel=class CBC extends _BC{constructor(n){super(NS+n);}}}

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);