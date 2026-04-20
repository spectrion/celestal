(function(G) {
  'use strict';
  const poll=(fn,n)=>G.Celestial&&G.Celestial.BASE?fn():n<80&&setTimeout(()=>poll(fn,(n||0)+1),50);
  poll(()=>{
    const { BASE }=G.Celestial; if(!BASE) return;
    let origin=''; try{origin=new URL(BASE).origin;}catch{return;}
    const def=(o,p,v)=>{try{Object.defineProperty(o,p,{get:typeof v==='function'?v:()=>v,configurable:true});}catch{}};
    const nav=G.navigator;
    def(nav,'userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    def(nav,'appVersion','5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    def(nav,'appName','Netscape'); def(nav,'platform','Win32'); def(nav,'vendor','Google Inc.');
    def(nav,'language','en-US'); def(nav,'languages',Object.freeze(['en-US','en']));
    def(nav,'onLine',true); def(nav,'cookieEnabled',true); def(nav,'doNotTrack',null);
    def(nav,'maxTouchPoints',0); def(nav,'hardwareConcurrency',8); def(nav,'deviceMemory',8);
    def(nav,'webdriver',false); // CRITICAL — many sites block automation

    try{
      const fp=(name,desc,mime)=>{const m={type:mime,suffixes:'',description:'',enabledPlugin:null};const p={name,description:desc,filename:name+'.dll',length:1,0:m,item:i=>i===0?m:null,namedItem:n=>n===mime?m:null,[Symbol.iterator]:function*(){yield m;}};m.enabledPlugin=p;return p;};
      const plugins=[fp('Chrome PDF Plugin','Portable Document Format','application/x-google-chrome-pdf'),fp('Chrome PDF Viewer','','application/pdf'),fp('Native Client','','application/x-nacl'),fp('Widevine Content Decryption Module','Enables Widevine licenses','application/x-ppapi-widevine-cdm')];
      const pa=Object.assign(plugins,{length:plugins.length,refresh:()=>{},item:i=>plugins[i]||null,namedItem:n=>plugins.find(p=>p.name===n)||null,[Symbol.iterator]:plugins[Symbol.iterator].bind(plugins)});
      def(nav,'plugins',pa);
    }catch{}
    try{const s=G.screen;def(s,'width',1920);def(s,'height',1080);def(s,'availWidth',1920);def(s,'availHeight',1040);def(s,'colorDepth',24);def(s,'pixelDepth',24);}catch{}
    def(G,'origin',origin); def(G,'isSecureContext',true); def(G,'devicePixelRatio',1); def(G,'outerWidth',1920); def(G,'outerHeight',1080);
    if(nav.connection){try{def(nav.connection,'effectiveType','4g');def(nav.connection,'rtt',50);def(nav.connection,'downlink',10);def(nav.connection,'saveData',false);}catch{}}
    nav.getBattery=()=>Promise.resolve({charging:true,chargingTime:0,dischargingTime:Infinity,level:1.0,onchargingchange:null,onchargingtimechange:null,ondischargingtimechange:null,onlevelchange:null,addEventListener:()=>{},removeEventListener:()=>{}});
    if(nav.permissions&&nav.permissions.query){const _q=nav.permissions.query.bind(nav.permissions);nav.permissions.query=d=>['notifications','push','geolocation','clipboard-read','clipboard-write','microphone','camera'].includes(d.name)?Promise.resolve({state:'prompt',onchange:null}):_q(d).catch(()=>Promise.resolve({state:'denied',onchange:null}));}
    if(nav.geolocation){const e={code:1,message:'User denied Geolocation'};nav.geolocation.getCurrentPosition=(ok,err)=>{if(err)err(e);};nav.geolocation.watchPosition=(ok,err)=>{if(err)err(e);return 0;};nav.geolocation.clearWatch=()=>{};}
    if(!G.chrome)G.chrome={runtime:{id:undefined,connect:()=>{},sendMessage:()=>{}},loadTimes:()=>({requestTime:Date.now()/1000,startLoadTime:Date.now()/1000,commitLoadTime:Date.now()/1000,finishDocumentLoadTime:Date.now()/1000,finishLoadTime:Date.now()/1000,firstPaintTime:Date.now()/1000,firstPaintAfterLoadTime:0,navigationType:'Other',wasAlternateProtocolAvailable:false,wasFetchedViaSpdy:false,wasNpnNegotiated:false}),csi:()=>({startE:Date.now(),onloadT:Date.now(),pageT:Date.now(),tran:15}),app:{isInstalled:false}};
    if(G.Notification){def(G.Notification,'permission','default');G.Notification.requestPermission=()=>Promise.resolve('default');}
    try{if(G.name&&!G.name.startsWith('__c__'))G.name='__c__'+origin;}catch{}

  },0);
})(typeof globalThis!=='undefined'?globalThis:window);