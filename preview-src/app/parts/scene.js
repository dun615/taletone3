// Scene: canvas size, colour helpers, depth geometry, ambient motion bookkeeping, and the sky/particle/rail drawing.
// Methods of Component (src/app/component.js); the build attaches them with Object.assign.
var ComponentScene = {
  resize(){
    if(this.enforceMobileFxLayer) this.enforceMobileFxLayer();
    var mobile=this.isMobileMotion();
    this.dpr=Math.min(window.devicePixelRatio||1,mobile?1.35:2);
    var rect=this.canvas.getBoundingClientRect();
    this.W=Math.max(1,Math.round(rect.width||window.innerWidth));
    this.H=Math.max(1,Math.round(rect.height||(window.visualViewport&&window.visualViewport.height)||window.innerHeight));
    var pixelW=Math.max(1,Math.round(this.W*this.dpr));
    var pixelH=Math.max(1,Math.round(this.H*this.dpr));
    if(this.canvas.width!==pixelW) this.canvas.width=pixelW;
    if(this.canvas.height!==pixelH) this.canvas.height=pixelH;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this._layoutGeometryDirty = true;
    this._sceneDirty = true;
  },

  smooth(a,b,x){var t=this.cl((x-a)/(b-a),0,1);return t*t*(3-2*t);},

  hx(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];},

  mix(h1,h2,t){var a=this.hx(h1),b=this.hx(h2);return 'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')';},

  rgba(c1,c2,t){return 'rgba('+c1.map((v,i)=>Math.round(v+(c2[i]-v)*t)).join(',')+')';},

  collectMotionEls(){
    this.spins=Array.from(document.querySelectorAll('[data-spin]'));
    this.floats=Array.from(document.querySelectorAll('[data-float]'));
    this.floatCards=Array.from(document.querySelectorAll('.lift'));
    this.floatCards.forEach((el,i)=>{ if(el._fph==null){ el._fph=i*1.7; el._fpy=2.0+(i%3)*0.5; el._fpx=2.6+(i%4)*0.6; } });
    this.eqs=Array.from(document.querySelectorAll('[data-eq]'));
    this.bobs=Array.from(document.querySelectorAll('[data-bob]'));
    this.drifts=Array.from(document.querySelectorAll('[data-drift]'));
    // elements inside hidden (display:none) markup have a zero box that reads as "near the viewport";
    // leave them out so nothing invisible is animated every frame
    var shown=function(el){ return el.offsetParent!==null || getComputedStyle(el).position==='fixed'; };
    ['spins','floats','floatCards','eqs','bobs','drifts'].forEach(k=>{ this[k]=this[k].filter(shown); });
    this.motionEls=Array.from(new Set([].concat(this.spins,this.floats,this.floatCards,this.eqs,this.bobs,this.drifts)));
  },

  refreshLayoutGeometry(layoutHeight){
    this.collectMotionEls();
    var scEl=this.scroller, scrollTop=scEl?scEl.scrollTop:window.scrollY;
    var rootTop=scEl?scEl.getBoundingClientRect().top:0;
    for(var i=0;i<this.motionEls.length;i++){
      var el=this.motionEls[i], rect=el.getBoundingClientRect();
      el._motionBounds={top:rect.top-rootTop+scrollTop,height:rect.height};
    }
    this.sections=['c-home','c-members','c-projects','c-works','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
    this._railCenters=[];
    for(var si=0;si<this.sections.length;si++){
      var section=this.sections[si];
      this._railCenters.push(section.offsetTop+section.clientHeight*0.5);
    }
    this._bridgeOffsets=[];
    for(var bi=0;bi<(this.bridges||[]).length;bi++){
      var bridge=this.bridges[bi], outer=bridge._bridgeOuter||(bridge.closest?bridge.closest('[data-story-bridge-wrap]'):null);
      this._bridgeOffsets.push(outer?outer.offsetTop:NaN);
    }
    this._depthKeys=this._buildDepthKeys(layoutHeight);
    if(this._bridgeRun && this._bridgeRun.phase!=='advancing'){
      var anchor=this._bridgeOffsets[this._bridgeRun.index];
      if(Number.isFinite(anchor)) this.scroller.scrollTo({top:anchor,behavior:'auto'});
    }
    this._deepBookGeometry=null;
    var bookEl=document.querySelector('.tt-book2 .tb-scene');
    if(bookEl){
      var bookRect=bookEl.getBoundingClientRect();
      if(bookRect.width){
        var bookFloat=bookEl.closest?bookEl.closest('[data-float]'):null;
        var currentFloatY=bookFloat&&Number.isFinite(bookFloat._floatY)?bookFloat._floatY:0;
        this._deepBookGeometry={x:bookRect.left+bookRect.width/2,docY:bookRect.top+scrollTop+bookRect.height*0.68-currentFloatY,floatEl:bookFloat};
      }
    }
    this._layoutGeometryHeight=layoutHeight==null?(scEl?scEl.scrollHeight:document.documentElement.scrollHeight):layoutHeight;
    this._layoutGeometryDirty=false;
  },

  // Depth journey: every chapter holds its own water layer (palette depth 0..1 and metres).
  // The descent to the next layer happens between a chapter's bridge and the next chapter,
  // so the sea visibly gets deeper at each handoff instead of drifting with page length.
  _buildDepthKeys(layoutHeight){
    var layers=[['c-home',0.2,0],['c-members',0.34,200],['c-projects',0.45,600],['c-works',0.6,1200],['c-contact',0.84,3200]];
    var scEl=this.scroller, bridgeTops=(this._bridgeOffsets||[]).filter(Number.isFinite), keys=[];
    for(var i=0;i<layers.length;i++){
      var el=document.getElementById(layers[i][0]); if(!el) continue;
      var top=el.offsetTop, next=i+1<layers.length?document.getElementById(layers[i+1][0]):null;
      if(keys.length&&top<=keys[keys.length-1][0]) top=keys[keys.length-1][0]+1;
      keys.push([top,layers[i][1],layers[i][2]]);
      if(next&&next.offsetTop>top+2){
        var hold=top+el.offsetHeight*0.5, bridge=null;
        bridgeTops.forEach(function(b){ if(b>top&&b<next.offsetTop) bridge=b; });
        // a bridge is the descent between two chapters: it sits halfway down in colour and depth,
        // so its words already belong to the deeper water (light text once the sea has darkened)
        if(bridge!=null){
          keys.push([Math.min(hold,bridge-1),layers[i][1],layers[i][2]]);
          keys.push([Math.min(bridge,next.offsetTop-1),(layers[i][1]+layers[i+1][1])/2,(layers[i][2]+layers[i+1][2])/2]);
        } else keys.push([Math.min(hold,next.offsetTop-1),layers[i][1],layers[i][2]]);
      }
    }
    var maxScroll=Math.max(0,(layoutHeight||(scEl?scEl.scrollHeight:0))-(scEl?scEl.clientHeight:0));
    keys.push([Math.max(maxScroll,keys.length?keys[keys.length-1][0]+1:1),0.95,4000]); // sea floor: the book
    // the gauge counts every metre: linear between chapter tops, not held per chapter
    this._meterKeys=keys.filter(function(k,i){ return i===0||i===keys.length-1||k[2]!==keys[i-1][2]; }).map(function(k){ return [k[0],k[2]]; });
    return keys;
  },

  _depthAt(sc){
    var k=this._depthKeys;
    if(!k||!k.length) return null;
    if(sc<=k[0][0]) return {d:k[0][1],m:this._metresAt(sc)};
    for(var i=0;i<k.length-1;i++){
      if(sc<=k[i+1][0]){
        var t=this.smooth(k[i][0],k[i+1][0],sc);
        return {d:k[i][1]+(k[i+1][1]-k[i][1])*t,m:this._metresAt(sc)};
      }
    }
    var last=k[k.length-1];
    return {d:last[1],m:this._metresAt(sc)};
  },

  _metresAt(sc){
    var k=this._meterKeys;
    if(!k||!k.length) return 0;
    if(sc<=k[0][0]) return k[0][1];
    for(var i=0;i<k.length-1;i++){
      if(sc<=k[i+1][0]) return k[i][1]+(k[i+1][1]-k[i][1])*this.cl((sc-k[i][0])/((k[i+1][0]-k[i][0])||1),0,1);
    }
    return k[k.length-1][1];
  },

  _depthZone(m){
    var lang=this.lang||'kr', i=m>=3800?3:(m>=1000?2:(m>=200?1:0));
    return ({kr:['표층','중층','심해','마법의 서'],en:['Sunlight zone','Twilight zone','Midnight zone','The Book'],jp:['表層','中深層','深海','魔法の書']}[lang]||[])[i]||'';
  },

  isNearViewport(el, margin, bounds, scrollTop, viewportHeight){
    if(!el || !el.getBoundingClientRect) return false;
    var vh=viewportHeight==null?(window.innerHeight||800):viewportHeight, m=margin==null?vh*0.75:margin;
    if(bounds){
      var top=bounds.top-(scrollTop==null?(this.scroller?this.scroller.scrollTop:window.scrollY):scrollTop);
      return top+bounds.height>=-m && top<=vh+m;
    }
    var b=el.getBoundingClientRect();
    return b.bottom>=-m && b.top<=vh+m;
  },

  setMotionIdle(el, idle){
    if(!el || el._motionIdle === idle) return;
    el._motionIdle = idle;
    el.style.willChange = idle ? 'auto' : 'transform,opacity';
    el.style.setProperty('--tt-motion-play-state',idle?'paused':'running');
  },

  // Skip unchanged root styles between frames.
  setCssVar(style, name, value){
    this._cssVarCache = this._cssVarCache || {};
    if(this._cssVarCache[name] === value) return;
    this._cssVarCache[name] = value;
    style.setProperty(name, value);
  },

  // utilities
  cl(v,a,b){return v<a?a:v>b?b:v;},

  isMobileMotion(){
    return window.innerWidth <= 760;
  },

  markScrollIntent(sc){
    var now=performance.now();
    var pos = sc != null ? sc : (this.scroller ? this.scroller.scrollTop : window.scrollY);
    if(this._lastScrollSampleT != null){
      var dt=Math.max(16, now-this._lastScrollSampleT);
      this._scrollSpeed=Math.abs(pos-this._lastScrollSampleY)/dt;
      if(this.isMobileMotion() && this._scrollSpeed>1.15) this._fastScrollUntil=now+320;
    }
    this._lastScrollSampleT=now;
    if(pos!==this._lastScrollSampleY) this._lastScrollMoveAt=now;
    this._lastScrollSampleY=pos;
    return now;
  },

  isFastMobileScroll(now){
    return !this._bridgeRun && this.isMobileMotion() && ((now||performance.now()) < (this._fastScrollUntil||0));
  },

  skyColors(stops,p){
    var s=stops;
    for(var i=0;i<s.length-1;i++){
      if(p<=s[i+1][0]){
        var t=(p-s[i][0])/(s[i+1][0]-s[i][0]||1);
        return [this.mix(s[i][1],s[i+1][1],t), this.mix(s[i][2],s[i+1][2],t)];
      }
    }
    return [s[s.length-1][1], s[s.length-1][2]];
  },

  draw(n, pal, fastMobile){
    var c=this.ctx, W=this.W, H=this.H;
    c.clearRect(0,0,W,H);
    var time=(performance.now()-this.t0)/1000;
    var scTop=this.scroller?this.scroller.scrollTop:0, tw=this._reduceMotion?0:time;
    // ---- the sea, by depth: light from the surface above, falling snow, then darkness and living light ----
    var metres=this._depthMeters!=null?this._depthMeters:0;
    var dd=this._depthColor!=null?this._depthColor:n;
    var shallow=1-this.smooth(0,800,metres);            // sunlight zone: caustics + god rays
    var deep=this.smooth(500,2600,metres);              // twilight -> midnight: vignette + bioluminescence
    var surf=1-this.smooth(0,H*1.1,scTop);              // the surface itself, only over Home
    c.save();
    // 1) the surface seen from just below: a bright, rippling ceiling with a shimmering window of sky
    if(surf>0.01){
      var sy=-scTop*0.45;
      var band=c.createLinearGradient(0,sy,0,sy+H*0.5);
      band.addColorStop(0,'rgba(255,255,255,'+(0.95*surf)+')'); band.addColorStop(0.2,'rgba(240,252,255,'+(0.5*surf)+')'); band.addColorStop(1,'rgba(240,252,255,0)');
      c.fillStyle=band; c.fillRect(0,sy,W,H*0.5);
      var win=c.createRadialGradient(W*0.5,sy-H*0.05,0,W*0.5,sy-H*0.05,W*0.42);
      win.addColorStop(0,'rgba(255,255,255,'+(0.9*surf)+')'); win.addColorStop(0.55,'rgba(255,255,255,'+(0.25*surf)+')'); win.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=win; c.fillRect(0,sy-H*0.05,W,W*0.42);
      c.lineWidth=3; c.strokeStyle='rgba(255,255,255,'+surf+')'; c.beginPath();
      for(var sx=0;sx<=W+20;sx+=20){ var wy=sy+12+Math.sin(sx*0.017+tw*1.2)*5+Math.sin(sx*0.051-tw*0.8)*2.5; if(sx===0)c.moveTo(sx,wy); else c.lineTo(sx,wy); }
      c.stroke();
    }
    if(!this._softLight){
      var slc=document.createElement('canvas'); slc.width=slc.height=128; var slg=slc.getContext('2d');
      var slr=slg.createRadialGradient(64,64,0,64,64,64);
      slr.addColorStop(0,'rgba(255,255,255,1)'); slr.addColorStop(0.45,'rgba(255,255,255,.35)'); slr.addColorStop(1,'rgba(255,255,255,0)');
      slg.fillStyle=slr; slg.fillRect(0,0,128,128); this._softLight=slc;
    }
    // 2) dappled sunlight: a few soft patches of light that drift and breathe under the surface
    if(shallow>0.02&&this.dapples){
      var dapN=fastMobile?Math.min(this.dapples.length,5):this.dapples.length;
      for(var dpi=0;dpi<dapN;dpi++){
        var dp=this.dapples[dpi];
        var breath=0.6+0.4*Math.sin(tw*dp.sp+dp.ph);
        var dpx=(dp.x+Math.sin(tw*0.05+dp.ph)*0.04)*W, dpy=dp.y*H*0.6-scTop*0.2;
        if(dpy<-H*0.3) continue;
        var dpr=dp.r*Math.min(W,H)*(0.85+0.15*breath);
        c.globalAlpha=0.16*shallow*breath;
        c.drawImage(this._softLight,dpx-dpr,dpy-dpr*0.6,dpr*2,dpr*1.2);
      }
      c.globalAlpha=1;
    }
    // 3) god rays: slanted shafts of sun that sway, strongest near the surface
    var rays=Math.max(shallow,surf*0.9);
    if(rays>0.02){
      var rayN=fastMobile?4:7;
      for(var rr=0;rr<rayN;rr++){
        var rx=(0.06+rr*(0.9/rayN))*W+Math.sin(tw*0.17+rr*1.7)*W*0.03;
        var flick=0.7+0.3*Math.sin(tw*0.6+rr*2.3);
        var grd=c.createLinearGradient(0,0,0,H*0.9);
        grd.addColorStop(0,'rgba(255,255,255,'+(0.5*rays*flick).toFixed(3)+')'); grd.addColorStop(0.5,'rgba(235,252,255,'+(0.18*rays*flick).toFixed(3)+')'); grd.addColorStop(1,'rgba(235,252,255,0)');
        c.fillStyle=grd; c.save(); c.translate(rx,-20); c.rotate(0.24); c.fillRect(-W*0.03,0,W*(0.045+0.03*(rr%3)),H*1.15); c.restore();
      }
      // bubbles rising toward the light
      if(!fastMobile&&this.bubbles){
        c.lineWidth=1.2;
        for(var bb=0;bb<this.bubbles.length;bb++){
          var q=this.bubbles[bb];
          var qy=H-((time*q.sp*60+q.y*H+scTop*0.5)%(H+40));
          var qx=q.x*W+Math.sin(time*1.4+q.ph)*8;
          c.strokeStyle='rgba(255,255,255,'+(0.75*rays).toFixed(3)+')'; c.fillStyle='rgba(255,255,255,'+(0.18*rays).toFixed(3)+')';
          c.beginPath(); c.arc(qx,qy,q.r,0,6.283); c.fill(); c.stroke();
        }
      }
    }
    // 4) marine snow: specks that stream past as you dive (they move with the scroll), denser and brighter deeper
    var starLimit=fastMobile?Math.min(this.stars.length,48):this.stars.length;
    var snowA=0.28+0.5*this.smooth(100,1800,metres);
    var snowC=deep>0.5?pal.star:[255,255,255];
    c.fillStyle='rgb('+snowC[0]+','+snowC[1]+','+snowC[2]+')';
    for(var i=0;i<starLimit;i++){
      var s=this.stars[i];
      var twk=0.55+0.45*Math.sin(time*s.sp+s.ph);
      var syy=((s.y*H-scTop*(0.32+s.r*0.22)+time*6*s.sp)%H+H)%H;
      c.globalAlpha=snowA*twk;
      c.beginPath(); c.arc(s.x*W+Math.sin(time*0.3+s.ph)*6, syy, s.r*(1+deep*0.6), 0, 6.283); c.fill();
    }
    c.globalAlpha=1;
    // 5) the dark: edges close in as the light from above runs out
    if(deep>0.02){
      var R=Math.max(W,H);
      var vig=c.createRadialGradient(W*0.5,H*0.48,R*0.22,W*0.5,H*0.48,R*0.78);
      vig.addColorStop(0,'rgba(1,6,18,0)'); vig.addColorStop(1,'rgba(1,6,18,'+(0.62*deep).toFixed(3)+')');
      c.fillStyle=vig; c.fillRect(0,0,W,H);
    }
    // 6) bioluminescence: creatures of light drifting in the midnight zone
    if(deep>0.05&&this.bio){
      if(!this._bioSprites){
        this._bioSprites=[[120,232,255],[168,140,255],[255,214,140]].map(function(rgb){
          var cv=document.createElement('canvas'); cv.width=cv.height=64; var g=cv.getContext('2d');
          var gg=g.createRadialGradient(32,32,0,32,32,32);
          gg.addColorStop(0,'rgba('+rgb+',1)'); gg.addColorStop(0.22,'rgba('+rgb+',.55)'); gg.addColorStop(1,'rgba('+rgb+',0)');
          g.fillStyle=gg; g.fillRect(0,0,64,64); return cv;
        });
      }
      c.globalCompositeOperation='lighter';
      var bioN=fastMobile?Math.min(this.bio.length,12):this.bio.length;
      for(var b=0;b<bioN;b++){
        var o=this.bio[b];
        var pulse=Math.pow(0.5+0.5*Math.sin(time*o.sp+o.ph),2.2);
        var bx=((o.x+time*o.dx)%1+1)%1*W, by=((o.y*H-scTop*0.12+Math.sin(time*0.2+o.ph)*24)%H+H)%H;
        c.globalAlpha=deep*(0.25+0.75*pulse);
        var rad=o.r*(0.7+0.5*pulse);
        c.drawImage(this._bioSprites[o.c],bx-rad,by-rad,rad*2,rad*2);
      }
      c.globalAlpha=1; c.globalCompositeOperation='source-over';
    }
    // 6b) echo: in the news chapter a few motes of light rise slowly, the music travelling up to the world
    var echo=this.smooth(1500,1900,metres)*(1-this.smooth(2500,3000,metres));
    if(echo>0.02&&this.motes){
      c.globalCompositeOperation='lighter';
      for(var mi=0;mi<this.motes.length;mi++){
        var mo=this.motes[mi];
        var life=((tw*mo.sp+mo.ph)%1+1)%1;
        var mx=(0.5+mo.col*0.32)*W+Math.sin(tw*0.6+mo.ph*6)*14, my=H*(1.02-life*0.95);
        var mr=mo.r*(1-life*0.4);
        c.globalAlpha=echo*0.7*Math.sin(life*Math.PI);
        c.drawImage(this._softLight,mx-mr,my-mr,mr*2,mr*2);
      }
      c.globalAlpha=1; c.globalCompositeOperation='source-over';
    }
    // 7) the book's light far below: from the first screen, growing as you descend, until the real book takes over
    var bookG=this._deepBookGeometry;
    var bookScreenY=(bookG?bookG.docY:(this.scroller?this.scroller.scrollHeight:H))-scTop;
    var calling=(0.32+0.38*dd)*(1-this.smooth(H*1.5,H*0.85,bookScreenY))*(0.84+0.16*Math.sin(tw*0.9));
    if(calling>0.01){
      var gr=H*(0.45+0.5*dd), gx=bookG?bookG.x:W*0.5, gy=H+gr*0.26;
      var call=c.createRadialGradient(gx,gy,0,gx,gy,gr);
      call.addColorStop(0,'rgba(255,214,140,'+calling.toFixed(3)+')'); call.addColorStop(0.42,'rgba(255,214,140,'+(calling*0.38).toFixed(3)+')'); call.addColorStop(1,'rgba(255,214,140,0)');
      c.fillStyle=call; c.fillRect(0,H-gr,W,gr);
    }
    // 8) the book awakens: as it reaches the middle of the screen its light opens over the sea floor
    //    and a column of light rises toward the far surface; the illustration gets its halo too.
    // the light breaks out only once the cover has opened (the book wakes first, then shines)
    var openedK=this._bookOpenedAt?this.cl((performance.now()-this._bookOpenedAt-900)/1400,0,1):0;
    var awake=Math.max(bookG?this.smooth(H*1.05,H*0.5,bookScreenY):0,this.smooth(0.95,0.995,this.scrollP||0))*openedK;
    // near the middle of the screen, or at the very end of the journey (on phones the book never reaches the middle)
    var near=Math.max(bookG?this.smooth(H*1.05,H*0.5,bookScreenY):0,this.smooth(0.95,0.995,this.scrollP||0));
    if(awake>0.01){
      var abx=bookG.x, aby=bookScreenY;
      var bloomR=Math.max(W,H)*(0.35+0.45*awake);
      var bloom=c.createRadialGradient(abx,aby,0,abx,aby,bloomR);
      bloom.addColorStop(0,'rgba(255,226,160,'+(0.55*awake).toFixed(3)+')'); bloom.addColorStop(0.3,'rgba(255,214,140,'+(0.2*awake).toFixed(3)+')'); bloom.addColorStop(1,'rgba(255,214,140,0)');
      c.globalCompositeOperation='screen';
      c.fillStyle=bloom; c.fillRect(0,0,W,H);

      c.globalCompositeOperation='source-over';
    }
    var awakeNow=near>0.6;
    if(this._bookAwake!==awakeNow){ this._bookAwake=awakeNow; document.body.classList.toggle('tt-book-awake',awakeNow); }
    if(awakeNow&&!this._bookOpened){ this._bookOpened=true; this._bookOpenedAt=performance.now(); document.body.classList.add('tt-book-opened'); }
    c.restore();
    // story fragments ??born at the book's light, rising the full deep up to Home (faint at the surface)
    var base=pal.star;
    var sc = this.scroller ? this.scroller.scrollTop : 0;
    var nowS = time, dt = (this._ptime!=null)? Math.min(0.05, nowS-this._ptime) : 0.016; this._ptime=nowS;
    var bookGeometry=this._deepBookGeometry;
    var cx=bookGeometry?bookGeometry.x:W*0.5;
    var bookFloatY=bookGeometry&&bookGeometry.floatEl&&Number.isFinite(bookGeometry.floatEl._floatY)?bookGeometry.floatEl._floatY:0;
    var bookDocY=bookGeometry?bookGeometry.docY+bookFloatY:(this.scroller?this.scroller.scrollHeight:H)-H*0.42;
    c.save();
    c.textAlign='center'; c.textBaseline='middle';
    var curr = (this.props.current!=null?this.props.current:1);          // story-current: liveliness of rising fragments
    var partN = Math.round(this.parts.length*this.cl(curr,0,1.5));
    if(fastMobile) partN=Math.min(partN,32);
    for(var k=0;k<partN;k++){
      var p=this.parts[k];
      p.life += p.speed*dt*(0.5+curr*0.7); if(p.life>=1){ p.life-=1; p.col=Math.random()*2-1; }
      var dl = p.life*p.life;                          // bias density toward the book (source)
      var docY = bookDocY*(1-dl);                      // book (life 0) ??top/Home (life 1)
      var y = docY - sc;
      if(y < -50 || y > H+50) continue;
      // tight column at the source, fanning gently wider as it rises toward the surface
      var x = cx + p.col*(16 + dl*W*0.17) + Math.sin(time*0.5+p.sway)*p.swayAmp;
      var twk = 0.6+0.4*Math.sin(time*1.3+p.sway);
      var glow = (0.92 - 0.66*dl) * twk;               // bright near book, faint near Home
      if(glow<=0.03) continue;
      var sz = p.sz*(1-0.34*dl);
      c.save(); c.translate(x,y);
      if(p.drop){
        c.globalAlpha=glow*0.7; c.fillStyle='rgba('+base[0]+','+base[1]+','+base[2]+',0.9)';
        c.shadowColor='rgba(150,210,225,0.8)'; c.shadowBlur=8;
        c.beginPath(); c.ellipse(0,0,sz*0.32,sz*0.46,0,0,6.283); c.fill(); c.shadowBlur=0;
      } else {
        c.rotate(Math.sin(time*0.5+p.sway)*0.12+p.rot);
        c.font='600 '+sz.toFixed(0)+"px 'Hanken Grotesk','Noto Sans JP',sans-serif";
        c.globalAlpha=glow*0.55; c.shadowColor='rgba('+base[0]+','+base[1]+','+base[2]+',0.9)'; c.shadowBlur=10;
        c.fillStyle='rgba('+base[0]+','+base[1]+','+base[2]+','+Math.min(1,glow+0.25)+')';
        c.fillText(p.glyph,0,0); c.shadowBlur=0;
      }
      c.restore();
    }
    c.restore();
    c.globalAlpha=1;
    if(fastMobile){
      if(this.inks && this.inks.length>4) this.inks.splice(0,this.inks.length-4);
    } else {
      this.drawInk(time);
    }
    this.drawRail(n, pal, time);
  },

  // A bespoke luminous motif behind each bridge line ??each visualizes its sentence's meaning.
  drawInk(time){
    if(!this.inks||!this.inks.length) return;
    var c=this.ctx, now=performance.now();
    c.save(); c.globalCompositeOperation='source-over';
    for(var i=this.inks.length-1;i>=0;i--){
      var k=this.inks[i], age=(now-k.t)/k.life;
      if(age>=1){ this.inks.splice(i,1); continue; }
      var e=1-Math.pow(1-age,2.2);
      for(var b=0;b<k.blobs.length;b++){
        var bl=k.blobs[b];
        var r=bl.r0 + e*bl.grow;
        var x=k.x+bl.ox*e*1.3 + Math.sin(time*0.8+bl.ph)*7*e;
        var y=k.y+bl.oy*e*1.3 - e*30; // diffuses & drifts up like ink in water
        var a=(1-age)*0.6*bl.a;
        var g=c.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba('+k.col[0]+','+k.col[1]+','+k.col[2]+','+a+')');
        g.addColorStop(0.45,'rgba('+k.col[0]+','+k.col[1]+','+k.col[2]+','+(a*0.55)+')');
        g.addColorStop(1,'rgba('+k.col[0]+','+k.col[1]+','+k.col[2]+',0)');
        c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,6.283); c.fill();
      }
    }
    c.restore();
  },

  spawnInk(x,y){
    if(!this.inks) this.inks=[];
    var pals=[[86,201,210],[199,154,78],[226,127,168],[120,150,255],[120,210,170],[255,196,120]];
    var col=pals[(Math.random()*pals.length)|0];
    var blobs=[]; var nb=4+(Math.random()*3|0);
    for(var i=0;i<nb;i++){ blobs.push({ox:(Math.random()*2-1)*40,oy:(Math.random()*2-1)*40,r0:6+Math.random()*14,grow:60+Math.random()*120,ph:Math.random()*6.28,a:0.6+Math.random()*0.4}); }
    this.inks.push({x:x,y:y,col:col,t:performance.now(),life:1700+Math.random()*900,blobs:blobs});
    if(this.inks.length>14) this.inks.shift();
  },

  // The score playhead: the whole page is one staff scrolling past a fixed reading head.
  // Each chapter's note ignites exactly as it reaches the head -> the reason the chapter "plays".
  drawRail(n, pal, time){
    // the decorative depth rail would cross reading and touch targets on compact screens; the chapter
    // menu shows progress there (this guard used to be patched in from support.js)
    if(window.innerWidth <= 1180) return;
    var c=this.ctx, vh=this.H;
    if(!this.sections||!this.sections.length||this.scrollCenter==null) return;
    var centers=this._railCenters;
    if(!centers||centers.length!==this.sections.length) return;
    var railX=Math.max(40, this.W*0.05), py=vh*0.5, k=0.165;
    var ar=this.hx(pal.accent), sr=pal.star;
    var nc=[Math.round(ar[0]+(sr[0]-ar[0])*n),Math.round(ar[1]+(sr[1]-ar[1])*n),Math.round(ar[2]+(sr[2]-ar[2])*n)];
    var ncs=nc[0]+','+nc[1]+','+nc[2];
    var lineC = n>0.5 ? 'rgba('+ncs+',0.3)' : 'rgba(110,124,168,0.32)';
    // guide staff line (gentle wave), full height
    c.lineWidth=1.4; c.strokeStyle=lineC; c.beginPath();
    for(var yy=-20;yy<=vh+20;yy+=7){ var xx=railX+Math.sin(yy*0.022+time*0.45)*5; if(yy<=-20)c.moveTo(xx,yy); else c.lineTo(xx,yy); }
    c.stroke();
    // chapter notes positioned by document distance from the reading head
    var pts=[];
    for(var i=0;i<centers.length;i++){
      var cc=centers[i];
      var yy=py + (cc - this.scrollCenter)*k;
      pts.push({y:yy, x:railX+Math.sin(yy*0.022+time*0.45)*5});
    }
    // beam connecting played notes
    c.lineWidth=2; c.strokeStyle='rgba('+ncs+',0.45)'; c.beginPath();
    for(var j=0;j<pts.length;j++){ if(j===0)c.moveTo(pts[j].x,pts[j].y); else c.lineTo(pts[j].x,pts[j].y); }
    c.stroke();
    // notes
    for(var m=0;m<pts.length;m++){
      var pt=pts[m], d=Math.abs(pt.y-py), g=this.cl(1-d/150,0,1);
      c.globalAlpha=0.18*g; c.fillStyle='rgb('+ncs+')';
      c.beginPath(); c.arc(pt.x,pt.y,7+11*g,0,6.283); c.fill();
      c.globalAlpha=0.55+0.45*g; 
      c.beginPath(); c.arc(pt.x,pt.y,2.6+3.6*g,0,6.283); c.fill();
      if(g>0.6){ // ignited -> sparkle
        c.globalAlpha=(g-0.6)/0.4; c.strokeStyle='rgb('+ncs+')'; c.lineWidth=1.4;
        var rr=6+9*g;
        c.beginPath(); c.moveTo(pt.x-rr,pt.y); c.lineTo(pt.x+rr,pt.y); c.moveTo(pt.x,pt.y-rr); c.lineTo(pt.x,pt.y+rr); c.stroke();
      }
    }
    c.globalAlpha=1;
    // reading head
    c.strokeStyle='rgb('+ncs+')'; c.lineWidth=2;
    c.beginPath(); c.arc(railX,py,12,0,6.283); c.stroke();
    c.globalAlpha=0.5; c.beginPath(); c.moveTo(railX-22,py); c.lineTo(railX-9,py); c.stroke(); c.globalAlpha=1;
    // depth readout: metres below the surface and the water zone, trailing the crosshair
    var metres=this._depthMeters!=null?this._depthMeters:0;
    c.fillStyle='rgb('+ncs+')'; c.textAlign='left'; c.textBaseline='middle';
    c.font='700 12px "Hanken Grotesk","Nanum Gothic","Noto Sans JP",sans-serif';
    c.globalAlpha=0.95; c.fillText(Math.round(metres).toLocaleString('en-US')+'m', railX+20, py-7);
    c.font='600 10px "Hanken Grotesk","Nanum Gothic","Noto Sans JP",sans-serif';
    c.globalAlpha=0.7; c.fillText(this._depthZone(metres)+' · '+Math.round((this.scrollP||0)*100)+'%', railX+20, py+9); c.globalAlpha=1;
  },
};
