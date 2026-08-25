/* Melisae-only ambience: tiny playful bees buzzing behind the UI. */
(function () {
  'use strict';
  var root=document.documentElement,topWindow=window,layer=null,renderTimer=null;
  try{if(window.top)topWindow=window.top;}catch(e){topWindow=window;}
  var isMaster=topWindow===window;
  function rand(a,b){return a+Math.random()*(b-a);}function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function active(){return root.getAttribute('data-easter-palette')==='melisae';}
  function reduced(){return root.getAttribute('data-motion')==='reduced';}
  function masterActive(){try{return topWindow.document.documentElement.getAttribute('data-easter-palette')==='melisae';}catch(e){return active();}}
  function masterReduced(){try{return topWindow.document.documentElement.getAttribute('data-motion')==='reduced';}catch(e){return reduced();}}
  function shared(){
    try{
      if(!topWindow.FetcherMelisaeBeeShared||topWindow.FetcherMelisaeBeeShared.version!==3)topWindow.FetcherMelisaeBeeShared={version:3,bees:[],nextId:1,timer:null,running:false};
      return topWindow.FetcherMelisaeBeeShared;
    }catch(e){
      if(!window.FetcherMelisaeBeeShared||window.FetcherMelisaeBeeShared.version!==3)window.FetcherMelisaeBeeShared={version:3,bees:[],nextId:1,timer:null,running:false};
      return window.FetcherMelisaeBeeShared;
    }
  }
  function ensureStyles(){
    if(document.getElementById('fetcher-melisae-styles'))return;
    var s=document.createElement('style');s.id='fetcher-melisae-styles';s.textContent=[
      '.fetcher-melisae-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="melisae"] .main>.stage,html[data-easter-palette="melisae"] .main>.foot,html[data-easter-palette="melisae"] .main>.settings-nav,html[data-easter-palette="melisae"] .main>.settings-content,html[data-easter-palette="melisae"] .main>.about,html[data-easter-palette="melisae"] .main>.donate,html[data-easter-palette="melisae"] .main>.updates,html[data-easter-palette="melisae"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-melisae-bee-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;animation:mel-bee-flight var(--dur) linear var(--delay) both;will-change:transform,opacity;}',
      '.fetcher-melisae-bee{position:absolute;left:0;top:0;width:var(--size);height:calc(var(--size)*.78);transform:translate(-50%,-50%);animation:mel-bee-bob var(--dur) ease-in-out var(--delay) both;filter:drop-shadow(0 5px 8px rgba(75,53,86,.10));}',
      '.fetcher-melisae-bee svg{display:block;width:100%;height:100%;overflow:visible;transform:scaleX(var(--flip,1));transform-origin:center;}',
      '@keyframes mel-bee-flight{0%{opacity:0;transform:translate3d(var(--x0),var(--y0),0)}5%{opacity:var(--op)}8%{transform:translate3d(var(--x1),var(--y1),0)}11%{transform:translate3d(var(--x1),var(--y1),0)}29%{transform:translate3d(var(--x2),var(--y2),0)}33%{transform:translate3d(var(--x2),var(--y2),0)}49%{transform:translate3d(var(--x3),var(--y3),0)}53%{transform:translate3d(var(--x4),var(--y4),0)}70%{transform:translate3d(var(--x5),var(--y5),0)}75%{transform:translate3d(var(--x5),var(--y5),0)}88%{transform:translate3d(var(--x6),var(--y6),0)}96%{opacity:var(--op)}100%{opacity:0;transform:translate3d(var(--x7),var(--y7),0)}}',
      '@keyframes mel-bee-bob{0%,100%{transform:translate(-50%,-50%) rotate(-4deg)}8%{transform:translate(-50%,-57%) rotate(8deg)}11%{transform:translate(-50%,-54%) rotate(5deg)}29%{transform:translate(-50%,-47%) rotate(-9deg)}33%{transform:translate(-50%,-51%) rotate(-4deg)}49%{transform:translate(-50%,-58%) rotate(9deg)}53%{transform:translate(-50%,-52%) rotate(2deg)}70%{transform:translate(-50%,-46%) rotate(-8deg)}75%{transform:translate(-50%,-50%) rotate(-3deg)}88%{transform:translate(-50%,-56%) rotate(7deg)}}',
      'html[data-theme="dark"][data-easter-palette="melisae"] .fetcher-melisae-bee{filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));}',
      'html[data-motion="reserved"] .fetcher-melisae-bee-flight,html[data-motion="reserved"] .fetcher-melisae-bee{animation-timing-function:var(--ease);}',
      'html[data-motion="reduced"] .fetcher-melisae-layer{display:none!important;}'
    ].join('\n');(document.head||document.documentElement).appendChild(s);
  }
  function syncColor(){if(!active())return;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',root.getAttribute('data-theme')==='dark'?'#211A29':'#F8F1FC');}
  function host(){return document.querySelector('.main')||document.body;}
  function ensureLayer(){var p=host();if(!p)return null;if(layer&&layer.isConnected&&layer.parentNode===p)return layer;if(layer&&layer.parentNode)layer.remove();layer=document.createElement('div');layer.className='fetcher-melisae-layer';layer.setAttribute('aria-hidden','true');p.insertBefore(layer,p.firstChild);return layer;}
  function art(){return '<svg viewBox="0 0 92 62" aria-hidden="true"><ellipse cx="31" cy="22" rx="13" ry="9" fill="#F0CBFF" opacity=".78"/><ellipse cx="48" cy="19" rx="13" ry="9" fill="#DCDCFF" opacity=".82"/><ellipse cx="49" cy="36" rx="21" ry="14" fill="#FEFFA2" stroke="#44364F" stroke-width="3"/><path d="M40 23v26M50 22v28M60 24v23" stroke="#44364F" stroke-width="5" stroke-linecap="round"/><circle cx="27" cy="36" r="8" fill="#44364F"/><circle cx="24" cy="34" r="1.5" fill="#fff"/><path d="m70 35 10 5-10 5Z" fill="#44364F"/><path d="M24 29q-4-8-10-10M30 28q1-8 6-12" fill="none" stroke="#44364F" stroke-width="2.4" stroke-linecap="round"/><circle cx="14" cy="19" r="2.3" fill="#F0CBFF" stroke="#44364F" stroke-width="1.5"/><circle cx="36" cy="16" r="2.3" fill="#DCDCFF" stroke="#44364F" stroke-width="1.5"/></svg>';}
  function points(kind,x,y){
    var p;
    if(kind===0)p=[[x-2,y+1],[x+6,y-7],[x+1,y-2],[x-7,y+7],[x-2,y+2],[x+7,y+9],[x+2,y+1],[x-8,y-6]];
    else if(kind===1)p=[[x-12,y+2],[x+7,y-8],[x+9,y-7],[x-2,y+10],[x-1,y+8],[x+15,y-2],[x+17,y-4],[x+4,y+10]];
    else p=[[x-7,y],[x+5,y-7],[x+8,y-4],[x-6,y+6],[x-4,y+7],[x+10,y+8],[x+12,y+5],[x,y-8]];
    return p.map(function(q){return[clamp(q[0],5,95),clamp(q[1],8,92)];});
  }
  function makeBee(offset){var s=shared(),x=rand(13,87),y=rand(17,83);return{id:s.nextId++,bornAt:Date.now()+(offset||0),duration:rand(4800,7200),opacity:rand(.76,.94),size:rand(28,37),flip:Math.random()<.5?-1:1,points:points(Math.floor(rand(0,3)),x,y)};}
  function prune(s){var n=Date.now();s.bees=s.bees.filter(function(b){return n<b.bornAt+b.duration+350;});}
  function add(s,offset){s.bees.push(makeBee(offset||0));}
  function schedule(){if(!isMaster)return;var s=shared();clearTimeout(s.timer);s.timer=null;if(!s.running||!masterActive()||masterReduced())return;s.timer=setTimeout(function(){if(!s.running||!masterActive()||masterReduced())return;prune(s);if(s.bees.length<3)add(s,0);if(Math.random()<.24&&s.bees.length<2)add(s,rand(500,950));schedule();},rand(3500,5400));}
  function syncMaster(){if(!isMaster)return;var s=shared();if(masterActive()&&!masterReduced()){if(!s.running){s.running=true;s.bees=[];add(s,300);add(s,1900);}if(!s.timer)schedule();}else{clearTimeout(s.timer);s.timer=null;s.running=false;s.bees=[];}}
  function render(b){var t=ensureLayer();if(!t)return;var w=Math.max(320,t.clientWidth||window.innerWidth||900),h=Math.max(320,t.clientHeight||window.innerHeight||700),age=Date.now()-b.bornAt,n=document.createElement('span');n.className='fetcher-melisae-bee-flight';n.setAttribute('data-melisae-bee-id',b.id);n.style.setProperty('--dur',b.duration+'ms');n.style.setProperty('--delay',(-age)+'ms');n.style.setProperty('--op',b.opacity);b.points.forEach(function(p,i){n.style.setProperty('--x'+i,(p[0]*w/100).toFixed(1)+'px');n.style.setProperty('--y'+i,(p[1]*h/100).toFixed(1)+'px');});var a=document.createElement('span');a.className='fetcher-melisae-bee';a.style.setProperty('--size',b.size+'px');a.style.setProperty('--flip',b.flip||1);a.style.setProperty('--dur',b.duration+'ms');a.style.setProperty('--delay',(-age)+'ms');a.innerHTML=art();n.appendChild(a);t.appendChild(n);}
  function syncRendered(){if(!active()||reduced()){if(layer)layer.replaceChildren();return;}var t=ensureLayer(),s=shared(),now=Date.now(),live={};if(!t)return;prune(s);s.bees.forEach(function(b){if(now>=b.bornAt+b.duration+350)return;live[b.id]=true;if(!t.querySelector('[data-melisae-bee-id="'+b.id+'"]'))render(b);});Array.prototype.forEach.call(t.querySelectorAll('[data-melisae-bee-id]'),function(n){if(!live[n.getAttribute('data-melisae-bee-id')])n.remove();});}
  function startRenderer(){clearInterval(renderTimer);renderTimer=null;if(!active()||reduced())return;ensureLayer();syncRendered();renderTimer=setInterval(syncRendered,180);}
  function stopRenderer(){clearInterval(renderTimer);renderTimer=null;if(layer)layer.replaceChildren();}
  function syncAll(){syncColor();syncMaster();if(active()&&!reduced())startRenderer();else stopRenderer();}
  document.addEventListener('fetcher:easter-change',syncAll);document.addEventListener('fetcher:pref-change',function(e){if(!e||!e.detail)return;if(e.detail.key==='fetcher.motion')syncAll();if(e.detail.key==='fetcher.theme')syncColor();});window.addEventListener('pageshow',syncAll);window.addEventListener('resize',function(){if(active()&&!reduced())startRenderer();});
  if(window.MutationObserver)new MutationObserver(syncColor).observe(root,{attributes:true,attributeFilter:['data-theme']});
  function init(){ensureStyles();syncAll();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
