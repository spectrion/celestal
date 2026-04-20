'use strict';
const http=require('http');
const https=require('https');
const {URL}=require('url');
const zlib=require('zlib');

function decompress(buf,enc){
  enc=(enc||'').toLowerCase().split(',')[0].trim();
  return new Promise(r=>{
    const cb=(e,d)=>r(e?buf:d);
    if(enc==='gzip')return zlib.gunzip(buf,cb);
    if(enc==='deflate')return zlib.inflate(buf,(e,d)=>e?zlib.inflateRaw(buf,cb):cb(null,d));
    if(enc==='br')return zlib.brotliDecompress(buf,cb);
    r(buf);
  });
}

const BLOCK_SEND=new Set([
  'host','connection','transfer-encoding','keep-alive','upgrade',
  'proxy-authorization','te','trailers','x-forwarded-for','x-forwarded-host',
  'x-forwarded-proto','x-real-ip','x-bare-url','x-bare-headers',
  'x-bare-forward-headers','x-bare-pass-headers','x-bare-id',
  'cf-connecting-ip','cf-ipcountry','cf-ray','cf-visitor','forwarded','via',
]);
const BLOCK_RECV=new Set([
  'transfer-encoding','connection','keep-alive','upgrade',
  'content-security-policy','content-security-policy-report-only',
  'x-frame-options','x-content-type-options','strict-transport-security',
  'expect-ct','permissions-policy','report-to','nel','link',
  'cross-origin-embedder-policy','cross-origin-opener-policy',
  'cross-origin-resource-policy','origin-agent-cluster','x-xss-protection',
]);
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  'Access-Control-Allow-Headers':'*',
  'Access-Control-Expose-Headers':'*',
  'Access-Control-Max-Age':'86400',
};

function siteHeaders(h){
  h=h.toLowerCase();
  if(h.includes('twitch.tv')||h.includes('twitchapps')||h.includes('jtvnw'))
    return{'client-id':'kimne78kx3ncx6brgo4mv6wki5h1ko','sec-fetch-mode':'cors','sec-fetch-site':'same-site'};
  if(h.includes('discord.com')||h.includes('discordapp.com'))
    return{'sec-fetch-mode':'cors','sec-fetch-site':'same-origin'};
  if(h.includes('youtube.com')||h.includes('googlevideo.com')||h.includes('ytimg.com'))
    return{'sec-fetch-site':'same-origin'};
  if(h.includes('reddit.com')||h.includes('redd.it'))
    return{'sec-fetch-mode':'cors','sec-fetch-site':'same-origin'};
  if(h.includes('instagram.com'))
    return{'sec-fetch-mode':'navigate','sec-fetch-site':'none'};
  if(h.includes('twitter.com')||h.includes('x.com'))
    return{'sec-fetch-mode':'navigate','sec-fetch-site':'none'};
  if(h.includes('netflix.com'))
    return{'sec-fetch-mode':'navigate','sec-fetch-site':'none'};
  if(h.includes('roblox.com')||h.includes('rbxcdn.com'))
    return{'sec-fetch-mode':'cors','sec-fetch-site':'cross-site','origin':'https://www.roblox.com'};
  return{};
}

function smartAccept(path,ct){
  const p=(path||'').toLowerCase();
  if(ct&&ct.includes('application/json'))return 'application/json, **';
  if(p.endsWith('.css'))return 'text/css,**;q=0.9';
  if(/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/.test(p))return 'image/avif,image/webp,image/apng,image*;q=0.8';
  if(/\.(mp4|webm|mkv|m3u8|ts)$/.test(p))return '**;q=0.8,application/signed-exchange;v=b3;q=0.7';
}

function isText(ct){
  ct=(ct||'').toLowerCase().split(';')[0].trim();
  return ct.startsWith('text/')||[
    'application/javascript','application/x-javascript','application/json',
    'application/xml','application/xhtml+xml','application/x-www-form-urlencoded',
    'application/manifest+json','application/ld+json','application/graphql',
    'image/svg+xml',
  ].includes(ct);
}

exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers:CORS,body:''};
  const rawUrl=(event.headers['x-bare-url']||'').trim();
  if(!rawUrl)return{
    statusCode:200,
    headers:{...CORS,'Content-Type':'application/json'},
    body:JSON.stringify({versions:['v1','v2'],language:'NodeJS',project:{name:'Celestial',version:'14.0.0'}}),
  };

  let target;
  try{target=new URL(rawUrl);}
  catch{return{statusCode:400,headers:CORS,body:'Invalid URL'};}

  const isHttps=target.protocol==='https:';
  const port=target.port?parseInt(target.port):(isHttps?443:80);
  const method=event.httpMethod;
  const hn=target.hostname.toLowerCase();

  const reqH={
    'host':target.hostname,
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'accept':smartAccept(target.pathname,event.headers['x-bare-headers']&&JSON.parse(event.headers['x-bare-headers']||'{}')['content-type']),
    'accept-language':'en-US,en;q=0.9',
    'accept-encoding':'gzip, deflate, br',
    'sec-ch-ua':'"Google Chrome";v="125","Chromium";v="125","Not.A/Brand";v="24"',
    'sec-ch-ua-arch':'"x86"',
    'sec-ch-ua-bitness':'"64"',
    'sec-ch-ua-full-version':'"125.0.6422.112"',
    'sec-ch-ua-mobile':'?0',
    'sec-ch-ua-model':'""',
    'sec-ch-ua-platform':'"Windows"',
    'sec-ch-ua-platform-version':'"15.0.0"',
    'sec-fetch-dest':method==='POST'?'empty':'document',
    'sec-fetch-mode':method==='POST'?'cors':'navigate',
    'sec-fetch-site':'none',
    'sec-fetch-user':'?1',
    'upgrade-insecure-requests':'1',
    'cache-control':'max-age=0',
    'dnt':'1',
    ...siteHeaders(hn),
  };

  let swH={};
  try{swH=JSON.parse(event.headers['x-bare-headers']||'{}');}catch{}
  for(const[k,v]of Object.entries(swH)){
    const kl=k.toLowerCase();
    if(!BLOCK_SEND.has(kl)&&v!=null)reqH[kl]=String(v);
  }
  for(const list of['x-bare-forward-headers','x-bare-pass-headers']){
    for(const h of(event.headers[list]||'').split(',')){
      const kl=h.trim().toLowerCase();
      if(kl&&!BLOCK_SEND.has(kl)&&event.headers[kl])reqH[kl]=event.headers[kl];
    }
  }

  let body=null;
  if(!['GET','HEAD'].includes(method)&&event.body){
    body=Buffer.from(event.body,event.isBase64Encoded?'base64':'utf8');
    reqH['content-length']=String(body.length);
    if(!reqH['content-type']){
      const s=body.toString('utf8',0,100);
      reqH['content-type']=(s.startsWith('{')||s.startsWith('['))?'application/json':'application/x-www-form-urlencoded';
    }
    reqH['sec-fetch-dest']='empty';
    reqH['sec-fetch-mode']='cors';
    reqH['sec-fetch-site']='same-origin';
  }

  const doReq=()=>new Promise((res,rej)=>{
    const chunks=[];
    const req=(isHttps?https:http).request(
      {method,hostname:target.hostname,port,path:target.pathname+target.search,
       headers:reqH,rejectUnauthorized:false,timeout:30000},
      r=>{
        r.on('data',c=>chunks.push(c));
        r.on('end',()=>res({sc:r.statusCode,sm:r.statusMessage,headers:r.headers,body:Buffer.concat(chunks)}));
        r.on('error',rej);
      }
    );
    req.on('error',rej);
    req.on('timeout',()=>{req.destroy();rej(Object.assign(new Error('Timeout'),{code:'ETIMEDOUT'}));});
    if(body)req.write(body);
    req.end();
  });

  let resp;
  try{resp=await doReq();}
  catch(e){
    if(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND'].includes(e.code)){
      await new Promise(r=>setTimeout(r,400));
      try{resp=await doReq();}
      catch(e2){return{statusCode:502,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify({error:e2.message})};}
    }else{
      return{statusCode:500,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify({error:e.message})};
    }
  }

  let buf=resp.body;
  try{buf=await decompress(buf,resp.headers['content-encoding']);}catch{}

  const outH={};
  for(const[k,v]of Object.entries(resp.headers)){
    const kl=k.toLowerCase();
    if(BLOCK_RECV.has(kl)||kl==='content-encoding'||kl==='content-length')continue;
    outH[k]=Array.isArray(v)?v.join(', '):v;
  }
  const ct=outH['content-type']||'application/octet-stream';
  const asText=isText(ct);
  return{
    statusCode:200,
    headers:{
      ...CORS,
      'x-bare-status':String(resp.sc),
      'x-bare-status-text':resp.sm||'',
      'x-bare-headers':JSON.stringify(outH),
      'content-type':ct,
      'content-length':String(buf.length),
    },
    body:asText?buf.toString('utf8'):buf.toString('base64'),
    isBase64Encoded:!asText,
  };
};
