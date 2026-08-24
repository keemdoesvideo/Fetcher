/* Wahibah-only ambience: one large constellation is drawn as a continuous travelling path. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;
  var VIEW_W = 600;
  var VIEW_H = 360;
  var DRAW_START = 820;
  var DRAW_DURATION = 4700;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }

  function active() {
    return root.getAttribute('data-easter-palette') === 'wahibah' && root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'wahibah' && masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) { return active(); }
  }

  /* Simplified recognisable stick-figure layouts based on real constellations.
     Traversal can revisit stars so branched shapes are still drawn as one unbroken path. */
  var REAL_TEMPLATES = [
    { name:'big dipper', points:[[70,210],[145,188],[220,196],[292,164],[365,126],[452,142],[526,105]], traversal:[0,1,2,3,4,5,6] },
    { name:'cassiopeia', points:[[72,235],[170,118],[278,224],[386,105],[520,208]], traversal:[0,1,2,3,4] },
    { name:'orion', points:[[178,78],[418,90],[235,170],[300,183],[365,170],[206,286],[402,292]], traversal:[0,2,3,4,1,4,6,4,3,2,5] },
    { name:'aries', points:[[108,214],[218,166],[346,183],[486,126]], traversal:[0,1,2,3] },
    { name:'taurus', points:[[86,106],[196,154],[292,214],[390,151],[522,88],[472,278]], traversal:[0,1,2,3,4,3,5] },
    { name:'gemini', points:[[150,82],[228,128],[246,212],[210,292],[418,86],[360,137],[344,218],[392,294]], traversal:[0,1,2,3,2,1,5,4,5,6,7] },
    { name:'cancer', points:[[298,82],[292,160],[292,226],[180,292],[424,286]], traversal:[0,1,2,3,2,4] },
    { name:'leo', points:[[120,230],[156,150],[226,105],[286,154],[260,218],[370,244],[488,190],[514,286]], traversal:[0,1,2,3,4,5,6,7,6] },
    { name:'virgo', points:[[90,120],[182,154],[272,126],[332,205],[424,176],[520,238],[332,205],[260,292]], traversal:[0,1,2,3,4,5,4,3,7] },
    { name:'libra', points:[[176,116],[410,104],[472,246],[286,292],[126,238]], traversal:[0,1,2,3,4,0,3] },
    { name:'scorpius', points:[[92,104],[150,154],[210,130],[260,188],[310,220],[370,242],[430,226],[482,270],[530,230]], traversal:[0,1,2,3,4,5,6,7,8] },
    { name:'sagittarius', points:[[130,220],[208,142],[310,158],[392,110],[468,184],[396,254],[286,270],[208,220]], traversal:[0,1,2,3,4,5,6,7,1,2,5] },
    { name:'capricorn', points:[[92,154],[210,110],[338,150],[500,126],[430,264],[270,286]], traversal:[0,1,2,3,4,5,0] },
    { name:'aquarius', points:[[80,126],[160,164],[242,118],[318,164],[402,128],[478,184],[522,260],[414,286]], traversal:[0,1,2,3,4,5,6,7] },
    { name:'pisces', points:[[92,98],[150,126],[174,188],[130,232],[80,196],[286,216],[392,240],[510,286]], traversal:[0,1,2,3,4,0,1,2,5,6,7] }
  ];

  function sharedState() {
    try {
      if (!topWindow.FetcherWahibahShared) topWindow.FetcherWahibahShared = { constellations:[], nextId:1, spawnTimer:null, running:false };
      return topWindow.FetcherWahibahShared;
    } catch (e) {
      if (!window.FetcherWahibahShared) window.FetcherWahibahShared = { constellations:[], nextId:1, spawnTimer:null, running:false };
      return window.FetcherWahibahShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.constellations = shared.constellations.filter(function (item) { return now < item.bornAt + item.duration + 250; });
  }

  function cloneTemplate(template, procedural) {
    var scaleX = rand(.92, 1.05);
    var scaleY = rand(.92, 1.06);
    var jitter = procedural ? 24 : 7;
    var points = template.points.map(function (p, index) {
      return {
        x: 300 + (p[0] - 300) * scaleX + rand(-jitter, jitter),
        y: 180 + (p[1] - 180) * scaleY + rand(-jitter, jitter),
        r: index === 0 ? rand(4.8, 5.8) : rand(3.5, 5.2)
      };
    });
    return { name:procedural ? template.name + ' variation' : template.name, points:points, traversal:template.traversal.slice() };
  }

  function makeModel(delay) {
    var shared = sharedState();
    var shape = cloneTemplate(pick(REAL_TEMPLATES), Math.random() < .28);
    return {
      id:shared.nextId++, bornAt:Date.now() + (delay || 0), duration:rand(9000,10400),
      left:rand(34,67), top:rand(31,69), width:rand(44,54), rotate:rand(-7,7),
      name:shape.name, points:shape.points, traversal:shape.traversal
    };
  }

  function addShared(delay) {
    if (!isMaster || !masterActive()) return null;
    var shared = sharedState();
    pruneShared();
    if (shared.constellations.length) return shared.constellations[0];
    var model = makeModel(delay || 0);
    shared.constellations.push(model);
    return model;
  }

  function scheduleNextFrom(model) {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive() || !model) return;
    var wait = Math.max(0, model.bornAt + model.duration - Date.now()) + rand(1100,2100);
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive()) return;
      pruneShared();
      if (shared.constellations.length) { scheduleNextFrom(shared.constellations[0]); return; }
      scheduleNextFrom(addShared(0));
    }, wait);
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.constellations = [];
    scheduleNextFrom(addShared(0));
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.constellations = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive()) startShared(); else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-wahibah-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-wahibah-styles';
    style.textContent = [
      'html[data-easter-palette="wahibah"] .fetcher-ambient-constellation{display:none!important;}',
      '.fetcher-wahibah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="wahibah"] .main>.stage,html[data-easter-palette="wahibah"] .main>.foot,html[data-easter-palette="wahibah"] .main>.settings-nav,html[data-easter-palette="wahibah"] .main>.settings-content,html[data-easter-palette="wahibah"] .main>.about,html[data-easter-palette="wahibah"] .main>.donate,html[data-easter-palette="wahibah"] .main>.updates,html[data-easter-palette="wahibah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-wahibah-constellation{position:absolute;left:var(--wah-left);top:var(--wah-top);width:var(--wah-width);max-width:660px;min-width:320px;height:auto;aspect-ratio:5/3;overflow:visible;opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);filter:drop-shadow(0 0 10px rgba(254,194,168,.10));animation:fetcher-wahibah-life var(--wah-duration) cubic-bezier(.45,0,.55,1) var(--wah-delay) both;}',
      '.fetcher-wahibah-nebula{opacity:0;animation:fetcher-wahibah-nebula var(--wah-duration) ease-in-out var(--wah-delay) both;}',
      '.fetcher-wahibah-path{fill:none;stroke:rgba(254,194,168,.70);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:var(--wah-path-length);stroke-dashoffset:var(--wah-path-length);opacity:0;filter:drop-shadow(0 0 4px rgba(254,194,168,.23));animation:fetcher-wahibah-path var(--wah-draw-duration) cubic-bezier(.24,.68,.3,1) calc(var(--wah-delay) + var(--wah-draw-start)) forwards;}',
      '.fetcher-wahibah-star{fill:rgba(255,230,214,.98);stroke:rgba(255,247,240,.78);stroke-width:.7;vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center;filter:drop-shadow(0 0 5px rgba(254,194,168,.48));animation:fetcher-wahibah-star-arrive 760ms cubic-bezier(.18,.78,.26,1) calc(var(--wah-delay) + var(--wah-star-arrival)) both;}',
      '.fetcher-wahibah-star.alt{fill:rgba(222,196,245,.98);filter:drop-shadow(0 0 5px rgba(205,165,239,.48));}',
      '@keyframes fetcher-wahibah-life{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);}5%{opacity:1;}68%{opacity:1;filter:drop-shadow(0 0 11px rgba(254,194,168,.12));}76%{opacity:1;filter:drop-shadow(0 0 30px rgba(254,194,168,.40)) drop-shadow(0 0 44px rgba(193,100,153,.22));}84%{opacity:1;filter:drop-shadow(0 0 14px rgba(254,194,168,.15));}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(1.012);filter:drop-shadow(0 0 8px rgba(254,194,168,.06));}}',
      '@keyframes fetcher-wahibah-path{0%{opacity:.12;stroke-dashoffset:var(--wah-path-length);}8%{opacity:.74;}100%{opacity:.74;stroke-dashoffset:0;}}',
      '@keyframes fetcher-wahibah-star-arrive{0%{opacity:0;transform:scale(.18);}38%{opacity:1;transform:scale(1.38);}70%,100%{opacity:.98;transform:scale(1);}}',
      '@keyframes fetcher-wahibah-nebula{0%,58%{opacity:0;}69%{opacity:.10;}76%{opacity:.24;}84%,100%{opacity:0;}}',
      'html[data-motion="reduced"] .fetcher-wahibah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-wahibah-constellation{width:72vw;min-width:260px;}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-wahibah-layer';
    layer.setAttribute('aria-hidden','true');
    parent.insertBefore(layer,parent.firstChild);
    return layer;
  }

  function distance(a,b) {
    var dx = b.x-a.x, dy = b.y-a.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  function pathMetrics(model) {
    var cumulative=[0], total=0;
    for (var i=1;i<model.traversal.length;i+=1) {
      total += distance(model.points[model.traversal[i-1]],model.points[model.traversal[i]]);
      cumulative.push(total);
    }
    return { total:Math.max(1,total), cumulative:cumulative };
  }

  function firstArrivalDistances(model,metrics) {
    var arrivals={};
    for (var i=0;i<model.traversal.length;i+=1) {
      var starIndex=model.traversal[i];
      if (arrivals[starIndex]===undefined) arrivals[starIndex]=metrics.cumulative[i];
    }
    return arrivals;
  }

  function pathData(model) {
    var first=model.points[model.traversal[0]];
    var d='M '+first.x.toFixed(1)+' '+first.y.toFixed(1);
    for (var i=1;i<model.traversal.length;i+=1) {
      var p=model.points[model.traversal[i]];
      d+=' L '+p.x.toFixed(1)+' '+p.y.toFixed(1);
    }
    return d;
  }

  function createSvg(model) {
    var ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 '+VIEW_W+' '+VIEW_H);
    svg.classList.add('fetcher-wahibah-constellation');
    svg.setAttribute('data-wahibah-id',String(model.id));
    svg.setAttribute('data-constellation-name',model.name);
    svg.style.setProperty('--wah-left',model.left+'%');
    svg.style.setProperty('--wah-top',model.top+'%');
    svg.style.setProperty('--wah-width',model.width+'vw');
    svg.style.setProperty('--wah-rotate',model.rotate+'deg');
    svg.style.setProperty('--wah-duration',model.duration+'ms');
    svg.style.setProperty('--wah-delay',(-(Date.now()-model.bornAt))+'ms');
    svg.style.setProperty('--wah-draw-start',DRAW_START+'ms');
    svg.style.setProperty('--wah-draw-duration',DRAW_DURATION+'ms');

    var defs=document.createElementNS(ns,'defs');
    var radial=document.createElementNS(ns,'radialGradient');
    radial.setAttribute('id','wahibahGlow-'+model.id);
    radial.setAttribute('cx','50%'); radial.setAttribute('cy','50%'); radial.setAttribute('r','50%');
    [['0%','#FEC2A8','.30'],['52%','#C16499','.13'],['100%','#C16499','0']].forEach(function(s){
      var stop=document.createElementNS(ns,'stop');
      stop.setAttribute('offset',s[0]); stop.setAttribute('stop-color',s[1]); stop.setAttribute('stop-opacity',s[2]); radial.appendChild(stop);
    });
    defs.appendChild(radial); svg.appendChild(defs);

    var nebula=document.createElementNS(ns,'ellipse');
    nebula.setAttribute('cx','300'); nebula.setAttribute('cy','180'); nebula.setAttribute('rx','250'); nebula.setAttribute('ry','134');
    nebula.setAttribute('fill','url(#wahibahGlow-'+model.id+')'); nebula.setAttribute('class','fetcher-wahibah-nebula'); svg.appendChild(nebula);

    var metrics=pathMetrics(model);
    var arrivals=firstArrivalDistances(model,metrics);
    var path=document.createElementNS(ns,'path');
    path.setAttribute('d',pathData(model));
    path.setAttribute('class','fetcher-wahibah-path');
    path.style.setProperty('--wah-path-length',metrics.total.toFixed(1));
    svg.appendChild(path);

    model.points.forEach(function(point,index){
      if (arrivals[index]===undefined) return;
      var star=document.createElementNS(ns,'circle');
      star.setAttribute('cx',point.x); star.setAttribute('cy',point.y); star.setAttribute('r',point.r);
      star.setAttribute('class','fetcher-wahibah-star'+(index%3===1?' alt':''));
      var arrivalMs=DRAW_START+(arrivals[index]/metrics.total)*DRAW_DURATION-120;
      star.style.setProperty('--wah-star-arrival',Math.max(180,arrivalMs).toFixed(0)+'ms');
      svg.appendChild(star);
    });
    return svg;
  }

  function syncRendered() {
    window.clearTimeout(renderTimer); renderTimer=null;
    if (!active()) { if (layer) layer.replaceChildren(); return; }
    ensureStyles();
    var target=ensureLayer();
    if (!target) return;
    pruneShared();
    var shared=sharedState(), live={}, now=Date.now();
    shared.constellations.forEach(function(model){
      if (now>=model.bornAt+model.duration+180) return;
      live[String(model.id)]=true;
      if (!target.querySelector('[data-wahibah-id="'+model.id+'"]')) target.appendChild(createSvg(model));
    });
    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-wahibah-constellation'),function(node){
      if (!live[node.getAttribute('data-wahibah-id')]) node.remove();
    });
    renderTimer=window.setTimeout(syncRendered,180);
  }

  function stopRenderer() { window.clearTimeout(renderTimer); renderTimer=null; if (layer) layer.replaceChildren(); }
  function startRenderer() { stopRenderer(); if (!active()) return; ensureStyles(); ensureLayer(); syncRendered(); }

  document.addEventListener('fetcher:easter-change',function(){ syncMasterActivity(); if(active()) startRenderer(); else stopRenderer(); });
  document.addEventListener('fetcher:pref-change',function(event){
    if(!event||!event.detail||event.detail.key!=='fetcher.motion') return;
    syncMasterActivity(); if(active()) startRenderer(); else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function(){
      syncMasterActivity();
      if(active()){ if(!renderTimer) startRenderer(); } else stopRenderer();
    }).observe(root,{attributes:true,attributeFilter:['data-easter-palette','data-motion']});
  }

  function init(){ ensureStyles(); syncMasterActivity(); if(active()) startRenderer(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
