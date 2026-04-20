'use strict';
const _u=new URL(location.href);
const BARE=_u.searchParams.get('bare')||'/.netlify/functions/bare';
const PREFIX=_u.searchParams.get('prefix')||'/celestial/';
const KEY=0x42;

function enc(str){
  const b=new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...b.map(v=>v^KEY))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function dec(str){
  try{
    const b=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
    return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)^KEY));
  }catch{return null;}
}
const toProxy=url=>PREFIX+enc(url);
const fromProxy=p=>dec(p.slice(PREFIX.length));

function proxify(raw,base){
  if(!raw)return raw;
  raw=String(raw).trim();
  if(!raw||/^(javascript:|data:|blob:|mailto:|tel:|#|about:|{)/.test(raw))return raw;
  if(raw.startsWith(PREFIX))return raw;
  try{return toProxy(new URL(raw,base).href);}catch{return raw;}
}

function rewriteCSS(css,base){
  if(!css||typeof css!=='string')return css;
  css=css.replace(/url\(\s*"([^"\\]*)"\s*\)/gi,(_,u)=>{
    u=u.trim();
    if(!u||/^(data:|blob:)/.test(u))return _;
    try{return`url("${toProxy(new URL(u,base).href)}")`;}catch{return _;}
  });
  css=css.replace(/url\(\s*'([^'\\]*)'\s*\)/gi,(_,u)=>{
    u=u.trim();
    if(!u||/^(data:|blob:)/.test(u))return _;
    try{return`url('${toProxy(new URL(u,base).href)}')`;}catch{return _;}
  });
  css=css.replace(/url\(\s*(?!["'])((?!data:|blob:)[^)\s'"\\]+)\s*\)/gi,(_,u)=>{
    u=u.trim();if(!u)return _;
    try{return`url(${toProxy(new URL(u,base).href)})`;}catch{return _;}
  });
  css=css.replace(/@import\s+"([^"\\]+)"/gi,(_,u)=>{
    try{return`@import "${toProxy(new URL(u.trim(),base).href)}"`;}catch{return _;}
  });
  css=css.replace(/@import\s+'([^'\\]+)'/gi,(_,u)=>{
    try{return`@import '${toProxy(new URL(u.trim(),base).href)}'`;}catch{return _;}
  });
  css=css.replace(/@import\s+url\(\s*"([^"\\]+)"\s*\)/gi,(_,u)=>{
    try{return`@import url("${toProxy(new URL(u.trim(),base).href)}")`;}catch{return _;}
  });
  css=css.replace(/@import\s+url\(\s*'([^'\\]+)'\s*\)/gi,(_,u)=>{
    try{return`@import url('${toProxy(new URL(u.trim(),base).href)}')`;}catch{return _;}
  });
  css=css.replace(/@import\s+url\(\s*(?!["'])((?!data:)[^)'"\\]+)\s*\)/gi,(_,u)=>{
    try{return`@import url(${toProxy(new URL(u.trim(),base).href)})`;}catch{return _;}
  });
  return css;
}

const URL_ATTRS=[
  'src','href','action','formaction','poster','data',
  'data-src','data-href','data-lazy','data-original','data-url','data-bg',
  'data-image','data-video','data-thumb','data-full','data-link','data-target',
  'data-background','data-bg-src','data-cover','data-bg-image',
  'data-background-image','data-lazy-bg','data-defer','data-echo',
  'data-src-retina','data-hi-res-src','data-poster','data-srcset',
  'ng-href','ng-src','x-src','x-href',
].join('|');
const ATTR_RE=new RegExp(`(\\b(?:${URL_ATTRS})\\s*=\\s*)(["'])([^"'<>]*)\\2`,'gi');

function rewriteSrcset(set,base){
  return set.replace(/([^\s,]+)(\s+[\d.]+[wx])?/g,(_,u,d)=>{
    u=u.trim();if(!u||u===',')return _||'';
    return proxify(u,base)+(d||'');
  });
}

function rewriteScriptContent(content,base){
  return content.replace(/(["'])(https?:\/\/[^"'\\]*?)\1/g,(m,q,url)=>{
    if(url.includes('${'))return m;
    const p=proxify(url,base);
    return p===url?m:q+p+q;
  });
}

function rewriteHTML(html,base){
  html=html.replace(/<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options|referrer-policy|permissions-policy|feature-policy|x-xss-protection)["']?[^>]*\/?>/gi,'');
  html=html.replace(/\s+integrity\s*=\s*(["'])[^"']*\1/gi,'');
  html=html.replace(/\s+crossorigin\s*(?:=\s*(["'])[^"']*\1)?/gi,'');
  html=html.replace(/<base[^>]*>/gi,'');

  ATTR_RE.lastIndex=0;
  html=html.replace(ATTR_RE,(m,attr,q,val)=>{
    val=val.trim();
    if(!val||/^(javascript:|data:|blob:|#|mailto:|tel:|about:|{)/.test(val))return m;
    const rw=proxify(val,base);
    return rw===val?m:attr+q+rw+q;
  });

  html=html.replace(/(\bsrcset\s*=\s*)(["'])([^"']*)(\2)/gi,(_,pre,q,set,q2)=>
    pre+q+rewriteSrcset(set,base)+q2);

  html=html.replace(/(\bcontent\s*=\s*)(["'])(https?:\/\/[^"'<>]+)\2/gi,(m,pre,q,url)=>{
    const rw=proxify(url,base);return rw===url?m:pre+q+rw+q;
  });

  html=html.replace(/(content\s*=\s*["'][^"']*?url\s*=\s*)([^;'">\s]+)/gi,
    (m,pre,url)=>pre+proxify(url.trim(),base));

  html=html.replace(/(\b(?:src|href|action|poster)\s*=\s*)(https?:\/\/[^\s>"'<]+)/gi,
    (m,a,url)=>a+proxify(url,base));

  html=html.replace(/(\b(?:src|href)\s*=\s*)(["'])(\/\/[^"'<>\s]+)\2/gi,(m,attr,q,url)=>{
    const abs='https:'+url;
    const rw=proxify(abs,base);
    return rw===abs?m:attr+q+rw+q;
  });

  html=html.replace(/\bstyle\s*=\s*"([^"]*)"/gi,(_,val)=>'style="'+rewriteCSS(val,base)+'"');
  html=html.replace(/\bstyle\s*=\s*'([^']*)'/gi,(_,val)=>"style='"+rewriteCSS(val,base)+"'");

  html=html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_,o,css,c)=>o+rewriteCSS(css,base)+c);

  html=html.replace(/(<noscript[^>]*>)([\s\S]*?)(<\/noscript>)/gi,(m,o,inner,c)=>{
    const rw=rewriteHTML(inner,base);
    return o+rw+c;
  });

  html=html.replace(/\bxlink:href\s*=\s*(["'])([^"'<>]*)\1/gi,(m,q,val)=>{
    val=val.trim();
    if(!val||val.startsWith('#')||/^(data:|javascript:)/.test(val))return m;
    const rw=proxify(val,base);return rw===val?m:`xlink:href=${q}${rw}${q}`;
  });

  html=html.replace(/(<script[^>]+type\s*=\s*["']importmap["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m,open,json,close)=>{
      try{
        const map=JSON.parse(json);
        const walk=o=>{
          if(!o)return;
          for(const k of Object.keys(o)){
            if(typeof o[k]==='string'&&/^https?:\/\//.test(o[k]))o[k]=proxify(o[k],base);
            else if(typeof o[k]==='object')walk(o[k]);
          }
        };
        walk(map);return open+JSON.stringify(map)+close;
      }catch{return m;}
    });

  html=html.replace(/(<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m,open,json,close)=>{
      const rw=json.replace(/"(url|image|contentUrl|thumbnailUrl|embedUrl|logo|sameAs)"\s*:\s*"(https?:\/\/[^"\\]+)"/gi,
        (_,k,url)=>`"${k}":"${proxify(url,base)}"`);
      return open+rw+close;
    });

  html=html.replace(/(<script(?:\s(?!src\s*=)[^>]*)?>)([\s\S]*?)(<\/script>)/gi,
    (m,open,content,close)=>{
      if(!content||!/https?:\/\//.test(content))return m;
      return open+rewriteScriptContent(content,base)+close;
    });

  const escBase=base.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  const baseTag=`<base href="${base.replace(/"/g,'&quot;')}">`;
  const inject=[
    `<script>window.__C_BASE__="${escBase}";window.__C_PREFIX__="${PREFIX}";window.__C_BARE__="${BARE}";</script>`,
    '<script src="/celestial/codec.js"></script>',
    '<script src="/celestial-client.js"></script>',
    '<script src="/celestial/csp.js"></script>',
    '<script src="/celestial/sandbox.js"></script>',
    '<script src="/celestial/element.js"></script>',
    '<script src="/celestial/dom-rewriter.js"></script>',
    '<script src="/celestial/style.js"></script>',
    '<script src="/celestial/fetch-hook.js"></script>',
    '<script src="/celestial/network.js"></script>',
    '<script src="/celestial/login.js"></script>',
    '<script src="/celestial/js-runtime.js"></script>',
    '<script src="/celestial/history.js"></script>',
    '<script src="/celestial/worker.js"></script>',
    '<script src="/celestial/storage.js"></script>',
    '<script src="/celestial/media.js"></script>',
    '<script src="/celestial/scope.js"></script>',
    '<script src="/celestial/navigator.js"></script>',
    '<script src="/celestial/yt.js"></script>',
    '<script src="/celestial/search.js"></script>',
    '<script src="/celestial/prefetch.js"></script>',
    '<script src="/celestial/error-handler.js"></script>',
  ].join('');

  if(/<head(\s[^>]*)?>/i.test(html))
    return html.replace(/(<head(\s[^>]*)?>)/i,`$1${baseTag}${inject}`);
  if(/<html(\s[^>]*)?>/i.test(html))
    return html.replace(/(<html(\s[^>]*)?>)/i,`$1<head>${baseTag}${inject}</head>`);
  return `<head>${baseTag}${inject}</head>`+html;
}

const cookieJar=new Map();
function saveCookies(origin,raw){
  if(!raw||!origin)return;
  const cookies=cookieJar.get(origin)||{};
  for(const r of(Array.isArray(raw)?raw:[raw])){
    const pair=r.split(';')[0],eq=pair.indexOf('=');
    if(eq<1)continue;
    const name=pair.slice(0,eq).trim(),val=pair.slice(eq+1).trim();
    if(r.toLowerCase().includes('max-age=0')||/expires=thu,?\s+01[\s-]jan[\s-]1970/i.test(r))
      delete cookies[name];
    else cookies[name]=val;
  }
  cookieJar.set(origin,cookies);
}
function getCookies(origin){
  const c=cookieJar.get(origin);
  return c?Object.entries(c).map(([k,v])=>`${k}=${v}`).join('; '):'';
}

async function proxyFetch(targetUrl,req,hops){
  if((hops||0)>12)throw new Error('Too many redirects');
  const method=req.method;
  let origin='';
  try{origin=new URL(targetUrl).origin;}catch{}

  const fwd={};
  const acc=req.headers.get('accept');
  const ct=req.headers.get('content-type');
  const auth=req.headers.get('authorization');
  const rng=req.headers.get('range');
  const referer=req.headers.get('referer');
  if(acc)fwd['accept']=acc;
  if(ct)fwd['content-type']=ct;
  if(auth)fwd['authorization']=auth;
  if(rng)fwd['range']=rng;
  if(referer){
    try{fwd['referer']=fromProxy(new URL(referer).pathname)||referer;}catch{fwd['referer']=referer;}
  }
  fwd['accept-language']=req.headers.get('accept-language')||'en-US,en;q=0.9';
  const merged=[req.headers.get('cookie')||'',getCookies(origin)].filter(Boolean).join('; ');
  if(merged)fwd['cookie']=merged;

  let body;
  if(!['GET','HEAD'].includes(method)){
    const buf=await req.arrayBuffer();
    if(buf.byteLength)body=buf;
  }

  let bareRes;
  try{
    bareRes=await fetch(BARE,{
      method,
      headers:{
        'x-bare-url':targetUrl,
        'x-bare-headers':JSON.stringify(fwd),
        'x-bare-forward-headers':'accept,accept-language,cookie,authorization,range,content-type,referer',
        'x-bare-pass-headers':'set-cookie,www-authenticate',
        'content-type':'application/octet-stream',
      },
      body:body||undefined,
    });
  }catch(e){throw new Error(`Network: ${e.message}`);}

  if(!bareRes.ok)throw new Error(`Bare ${bareRes.status} — redeploy to Netlify`);
  const xs=bareRes.headers.get('x-bare-status');
  if(!xs)throw new Error('Bad bare response — clear site data and refresh');

  const status=parseInt(xs||'200');
  const statusText=bareRes.headers.get('x-bare-status-text')||'';
  let resHdrs={};
  try{resHdrs=JSON.parse(bareRes.headers.get('x-bare-headers')||'{}');}catch{}
  const resType=(resHdrs['content-type']||'').toLowerCase();

  const sc=resHdrs['set-cookie']||resHdrs['Set-Cookie'];
  if(sc&&origin)saveCookies(origin,Array.isArray(sc)?sc:[sc]);

  if([301,302,303,307,308].includes(status)){
    const loc=resHdrs['location']||resHdrs['Location'];
    if(loc){
      try{
        const dest=new URL(loc,targetUrl).href;
        const nm=(status===303&&!['GET','HEAD'].includes(method))?'GET':method;
        return proxyFetch(dest,new Request(toProxy(dest),{method:nm}),(hops||0)+1);
      }catch{}
    }
  }

  const STRIP=new Set([
    'content-security-policy','content-security-policy-report-only',
    'x-frame-options','x-content-type-options','strict-transport-security',
    'content-encoding','transfer-encoding','connection','keep-alive',
    'cross-origin-embedder-policy','cross-origin-opener-policy',
    'cross-origin-resource-policy','permissions-policy',
    'expect-ct','report-to','nel','link','origin-agent-cluster',
    'x-xss-protection',
  ]);
  const outH=new Headers();
  for(const[k,v]of Object.entries(resHdrs)){
    if(!STRIP.has(k.toLowerCase()))
      try{outH.set(k,Array.isArray(v)?v.join(', '):String(v));}catch{}
  }
  outH.set('content-type',resHdrs['content-type']||'application/octet-stream');

  const buf=await bareRes.arrayBuffer();

  if(/text\/html/.test(resType)){
    const text=new TextDecoder('utf-8',{fatal:false}).decode(buf);
    return new Response(rewriteHTML(text,targetUrl),{status,statusText,headers:outH});
  }
  if(/text\/css/.test(resType)){
    const text=new TextDecoder('utf-8',{fatal:false}).decode(buf);
    return new Response(rewriteCSS(text,targetUrl),{status,statusText,headers:outH});
  }
  return new Response(buf,{status,statusText,headers:outH});
}

self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(!url.pathname.startsWith(PREFIX))return;
  const target=fromProxy(url.pathname);
  if(!target){e.respondWith(new Response('Bad proxy URL',{status:400}));return;}
  e.respondWith(
    proxyFetch(target,e.request).catch(err=>new Response(
      `<!DOCTYPE html><html><head><title>Celestial Error</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#000510;color:#4fc3ff;font-family:monospace;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh}.b{max-width:520px;width:100%}h2{font-size:20px;margin-bottom:16px;background:linear-gradient(90deg,#a0d8ff,#4fc3ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}p{color:#a0d8ff;line-height:1.7;margin-bottom:8px}small{display:block;margin-top:14px;color:rgba(160,216,255,.3);word-break:break-all;font-size:11px;padding:8px;background:rgba(79,195,255,.04);border-radius:6px;border:1px solid rgba(79,195,255,.08)}.r{display:flex;gap:10px;margin-top:24px}button{background:linear-gradient(135deg,#4fc3ff,#1a6fff);color:#000;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:700;font-family:monospace}button.s{background:rgba(79,195,255,.1);color:#4fc3ff;border:1px solid rgba(79,195,255,.3)}</style></head><body><div class="b"><h2>🌌 Celestial Error</h2><p>${err.message.replace(/</g,'&lt;')}</p><small>${target.replace(/</g,'&lt;').slice(0,200)}</small><div class="r"><button onclick="history.back()">← Back</button><button class="s" onclick="location.reload()">↺ Retry</button></div></div></body></html>`,
      {status:500,headers:{'content-type':'text/html'}}
    ))
  );
});
