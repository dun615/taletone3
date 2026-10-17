// Intro: the starfield and the first-visit dive into the page.
// Methods of Component (src/app/component.js); the build attaches them with Object.assign.
var ComponentIntro = {
  initStars(){
    // suspended plankton / light specks
    var mobile=this.isMobileMotion();
    this.stars = Array.from({length:mobile?60:120},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.3+0.3,ph:Math.random()*6.28,sp:Math.random()*1.6+0.4}));
    // story fragments rising from the deep ??glyphs of music & story (notes, letters, kana)
    var glyphs=['\u266a','\u266b','\u266a','\u266c','\u2669','A','S','T','\u3042','\u306e','\u304b','\uac00','\u2026','&','\u00a7'];
    this.parts = Array.from({length:mobile?36:90},(_,i)=>({
      life:Math.random(),                                   // 0 at book ??1 at surface (Home)
      speed:Math.random()*0.04+0.018,                       // life units / sec
      col:(Math.random()*2-1),                              // base column position -1..1
      sway:Math.random()*6.28, swayAmp:Math.random()*16+6,
      sz:Math.random()*7+7, rot:(Math.random()*0.5-0.25),
      glyph:glyphs[(Math.random()*glyphs.length)|0],
      drop:Math.random()<0.22                               // some are water droplets
    }));
    this.dapples = Array.from({length:mobile?5:8},()=>({x:Math.random(),y:Math.random(),r:Math.random()*0.18+0.16,sp:Math.random()*0.25+0.12,ph:Math.random()*6.28}));
    this.motes = Array.from({length:mobile?8:14},()=>({col:Math.random()*2-1,r:Math.random()*7+5,sp:Math.random()*0.035+0.025,ph:Math.random()}));
    this.bubbles = Array.from({length:mobile?0:22},()=>({x:Math.random(),y:Math.random(),r:Math.random()*4+1.5,sp:Math.random()*0.7+0.5,ph:Math.random()*6.28}));
    this.bio = Array.from({length:mobile?14:30},()=>({x:Math.random(),y:Math.random(),ph:Math.random()*6.28,sp:Math.random()*0.9+0.35,r:Math.random()*16+8,c:Math.random()<0.62?0:(Math.random()<0.6?1:2),dx:(Math.random()-0.5)*0.012}));
    this.inks = [];
  },

  // Preserve the original plunge, then resolve the underwater frame into the real HOME DOM.
  initIntro(){
    this._introMobile=window.innerWidth<=760;
    this.INTRO_PLUNGE_MS=2000;
    this.INTRO_MS=this._introMobile?2700:2950;
    this.introEl=document.getElementById('intro');
    var reduce=false;
    try{ reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

    var routePath=location.pathname;
    var canonical=document.querySelector('link[rel="canonical"]');
    if(canonical){
      try{ routePath=new URL(canonical.href,location.href).pathname; }catch(e){}
    }
    routePath=this._routePath(routePath||'/');
    var isHomeRoute=routePath==='/';
    var forceIntro=new URLSearchParams(location.search).get('intro')==='1',seen=false;
    try{ seen=sessionStorage.getItem('tt_intro_home_v5')==='1'; }catch(e){}
    // the dive: on the home page, once per visit (never with reduced motion)
    if(!isHomeRoute || (seen&&!forceIntro) || reduce){
      if(this.introEl) this.introEl.style.display='none';
      this.introDone=true;
      return;
    }
    this.initIntroV2();
  },

  // ===== Intro (preview): we dive. From just above the sea we lean in and go under in one continuous move:
  // the waterline sweeps up the frame (half above, half below), our own trail of bubbles streams up past us,
  // and the light from the surface above becomes the colour of the site, where Home settles into focus. =====
  initIntroV2(){
    var self=this;
    if(this.introEl) this.introEl.style.display='none';
    var cv=document.createElement('canvas');
    cv.id='intro-v2'; cv.setAttribute('aria-hidden','true');
    cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100lvh;z-index:1000;pointer-events:auto';
    document.body.appendChild(cv);
    var W=window.innerWidth, H=window.innerHeight, mobile=W<=760;
    var dpr=Math.min(window.devicePixelRatio||1, mobile?1.5:2);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
    var c=cv.getContext('2d');
    // timeline (ms): lean toward the sea, the waterline sweeps up through the frame, look up from below, Home settles
    var T={cross0:900, cross1:1380, reveal:1800, settled:mobile?3400:3700};
    var homeSky=this.skyColors(this.P[this.mood].stops,0.2);
    var hex=function(h){ h=String(h); var m=h.match(/\d+/g); if(h.indexOf('rgb')===0&&m) return m.slice(0,3).map(Number); h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
    var waterTop=hex(homeSky[0]), waterBot=hex(homeSky[1]);
    var rgb=function(a,al){ return 'rgba('+Math.round(a[0])+','+Math.round(a[1])+','+Math.round(a[2])+','+(al==null?1:al)+')'; };
    var shade=function(a,k,d){ return [a[0]-d[0]*k,a[1]-d[1]*k,a[2]-d[2]*k]; };
    var cl=function(x){ return Math.max(0,Math.min(1,x)); };
    var ease=function(x){ x=cl(x); return 1-Math.pow(1-x,3); };
    var easeIn=function(x){ x=cl(x); return x*x*x; };
    var inOut=function(x){ x=cl(x); return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2; };
    var smooth=function(a,b,x){ var k=cl((x-a)/(b-a)); return k*k*(3-2*k); };
    var gauss=function(){ return (Math.random()+Math.random()+Math.random()-1.5)/1.5; };
    // sun sparkles on the sea: position along the sun road (u), distance (v), twinkle rate
    var S=[]; for(var si=0;si<(mobile?90:170);si++){ var u=(Math.random()+Math.random()+Math.random())/1.5-1; S.push({u:u,v:Math.random(),f:Math.random()*5+2,ph:Math.random()*6.28}); }
    var glint=document.createElement('canvas'); glint.width=64; glint.height=20;
    (function(){ var gc=glint.getContext('2d'), gg=gc.createRadialGradient(32,10,0,32,10,32); gg.addColorStop(0,'rgba(255,252,238,1)'); gg.addColorStop(0.25,'rgba(255,248,226,.6)'); gg.addColorStop(1,'rgba(255,248,226,0)'); gc.setTransform(1,0,0,0.31,0,6.9); gc.fillStyle=gg; gc.fillRect(0,0,64,64); })();
    // our trail: bubbles born where we went in (bottom centre), mostly in the first moments, big first then small
    var B=[]; for(var i=0;i<(mobile?100:200);i++){
      var bf=Math.pow(Math.random(),1.8);
      B.push({birth:T.cross0+60+bf*1100, x0:0.5+gauss()*(0.24-0.12*bf), dir:gauss()*(1.4-bf), sp:(0.85+Math.random()*0.8-0.3*bf)*H, r:(3+Math.pow(Math.random(),2)*(mobile?26:38))*(1-0.6*bf), wob:Math.random()*6.28});
    }
    // spray thrown up off the waterline as it passes
    var D=[]; for(var d=0;d<(mobile?36:70);d++) D.push({x:Math.random(), vy:-(0.35+Math.random()*0.9), vx:(Math.random()-0.5)*0.3, r:Math.random()*2.6+0.8, t0:T.cross0+Math.random()*(T.cross1-T.cross0)*0.7});
    // light shafts from the surface, seen from below
    var R=[]; for(var ri=0;ri<4;ri++) R.push({x:0.14+ri*0.24+Math.random()*0.06, w:0.12+Math.random()*0.08, ph:Math.random()*6.28});
    var shaftSprite=document.createElement('canvas'); shaftSprite.width=64; shaftSprite.height=256;
    (function(){ var sc=shaftSprite.getContext('2d'); var hg=sc.createLinearGradient(0,0,64,0); hg.addColorStop(0,'rgba(220,246,250,0)'); hg.addColorStop(0.5,'rgba(220,246,250,1)'); hg.addColorStop(1,'rgba(220,246,250,0)'); sc.fillStyle=hg; sc.fillRect(0,0,64,256); sc.globalCompositeOperation='destination-in'; var vg=sc.createLinearGradient(0,0,0,256); vg.addColorStop(0,'rgba(0,0,0,1)'); vg.addColorStop(1,'rgba(0,0,0,0)'); sc.fillStyle=vg; sc.fillRect(0,0,64,256); })();
    // the real Home starts below us, soft and out of focus, and the chrome waits
    var home=document.getElementById('c-home');
    var chrome=['brand','lang-switcher','chapnav','progress'].map(function(id){ return document.getElementById(id); }).filter(Boolean);
    chrome.forEach(function(el){ el.style.opacity='0'; el.style.transition='opacity .9s ease'; });
    var setHome=function(k){ // k: 0 = far below and blurred, 1 = in place
      if(!home) return;
      if(k>=1){ home.style.transform=''; home.style.filter=''; home.style.willChange=''; return; }
      home.style.willChange='transform,filter';
      home.style.transform='translateY('+((1-k)*H*0.32).toFixed(1)+'px) scale('+(0.94+0.06*k).toFixed(4)+')';
      home.style.filter='blur('+((1-k)*12).toFixed(2)+'px)';
    };
    setHome(0);
    var released=false, finished=false, chromeShown=false, skipShift=0;
    // the waterline: a gently tilted, rippling edge; trace it left to right
    function lineY(x,base,ts,amp){ return base+(x-W/2)*0.06+Math.sin(x*0.012+ts*3.1)*amp+Math.sin(x*0.031-ts*2.2)*amp*0.45; }
    function traceLine(base,ts,amp){ for(var x=0;x<=W+20;x+=20){ var y=lineY(x,base,ts,amp); if(x===0) c.moveTo(x,y); else c.lineTo(x,y); } }
    function clipAbove(base,ts,amp){ c.beginPath(); c.moveTo(0,-10); c.lineTo(W+20,-10); c.lineTo(W+20,lineY(W+20,base,ts,amp)); for(var x=W;x>=0;x-=20) c.lineTo(x,lineY(x,base,ts,amp)); c.closePath(); c.clip(); }
    function clipBelow(base,ts,amp){ c.beginPath(); c.moveTo(0,H+10); c.lineTo(W+20,H+10); c.lineTo(W+20,lineY(W+20,base,ts,amp)); for(var x=W;x>=0;x-=20) c.lineTo(x,lineY(x,base,ts,amp)); c.closePath(); c.clip(); }

    function drawAbove(t,ts){
      var approach=easeIn(t/T.cross0);                       // slow lean, then the drop toward the water
      var hy=H*0.3-approach*H*0.36-Math.max(0,(t-T.cross0)/1000)*H*0.3;
      var sky=c.createLinearGradient(0,0,0,Math.max(1,hy));
      sky.addColorStop(0,'#8cc3d8'); sky.addColorStop(1,'#eef8f5');
      c.fillStyle=sky; c.fillRect(0,0,W,Math.max(0,hy));
      var sea=c.createLinearGradient(0,hy,0,H);
      sea.addColorStop(0,'#bfe4e6'); sea.addColorStop(0.25,'#6fb7c6'); sea.addColorStop(1,'#1f6a86');
      c.fillStyle=sea; c.fillRect(0,Math.max(0,hy),W,H);
      var near=1+approach*3;
      for(var g=0;g<S.length;g++){
        var sp=S[g], depthK=Math.pow(sp.v,1.6);
        var gy=hy+depthK*(H-hy)*1.05, spread=W*(0.06+0.42*depthK);
        var gx=W*0.5+sp.u*spread+Math.sin(ts*0.7+sp.ph)*8;
        var tw=Math.max(0,Math.sin(ts*sp.f+sp.ph)); tw=tw*tw*tw;
        var sz=(1.2+depthK*5)*near*(0.6+0.8*tw);
        c.globalAlpha=0.25+0.75*tw;
        c.drawImage(glint,gx-sz*2,gy-sz*0.6,sz*4,sz*1.2);
      }
      c.globalAlpha=1;
      var sun=c.createRadialGradient(W*0.5,hy,0,W*0.5,hy,W*0.5);
      sun.addColorStop(0,'rgba(255,244,214,.95)'); sun.addColorStop(1,'rgba(255,246,222,0)');
      c.fillStyle=sun; c.fillRect(0,hy-W*0.5,W,W);
    }

    // under the water: deep at first, brightening into exactly the colour of the site's sky
    function drawUnder(t,ts,surfaceY,alpha){
      var deepK=1-smooth(T.cross0,T.reveal+400,t);
      var top=shade(waterTop,deepK,[95,62,45]), bot=shade(waterBot,deepK,[120,90,62]);
      var wg=c.createLinearGradient(0,0,0,H);
      wg.addColorStop(0,rgb(top,alpha)); wg.addColorStop(1,rgb(bot,alpha));
      c.fillStyle=wg; c.fillRect(0,0,W,H);
      // the bright underside of the surface just above us, and the light that falls from it
      var glow=(1-smooth(T.cross1+200,T.reveal+700,t));
      if(glow>0.01){
        var gTop=Math.max(-H*0.2,surfaceY);
        var ceil=c.createLinearGradient(0,gTop,0,gTop+H*0.55);
        ceil.addColorStop(0,'rgba(240,252,255,'+(0.8*glow).toFixed(3)+')');
        ceil.addColorStop(0.12,'rgba(220,246,250,'+(0.26*glow).toFixed(3)+')');
        ceil.addColorStop(1,'rgba(220,246,250,0)');
        c.fillStyle=ceil; c.fillRect(0,Math.max(0,gTop),W,H*0.6);
        c.globalCompositeOperation='lighter';
        for(var ri=0;ri<R.length;ri++){
          var rr=R[ri], sway=Math.sin(ts*0.6+rr.ph)*W*0.02, x0=rr.x*W+sway, w=rr.w*Math.max(W,H*1.1), y0=Math.max(0,gTop);
          c.save(); c.globalAlpha=(mobile?0.13:0.2)*glow*(0.7+0.3*Math.sin(ts*1.3+rr.ph));
          c.setTransform(dpr*w/64,0,dpr*0.16,dpr*(H*0.9)/256,dpr*(x0-w/2),dpr*y0);
          c.drawImage(shaftSprite,0,0); c.restore();
        }
        c.setTransform(dpr,0,0,dpr,0,0);
        c.globalCompositeOperation='source-over';
      }
    }

    function drawBubbles(t,ts,fade){
      if(fade<=0.01) return;
      c.lineWidth=1.3;
      for(var bi=0;bi<B.length;bi++){
        var b=B[bi], age=(t-b.birth)/1000; if(age<0) continue;
        var dist=b.sp*age*(1-0.18*Math.min(age,2));
        var by=H*1.08-dist; if(by<-60) continue;
        var bx=b.x0*W+b.dir*W*0.16*age+Math.sin(ts*4+b.wob)*(3+b.r*0.15);
        var a=fade*(age<0.12?age/0.12:1);
        c.fillStyle='rgba(255,255,255,'+(0.14*a).toFixed(3)+')';
        c.strokeStyle='rgba(255,255,255,'+(0.72*a).toFixed(3)+')';
        c.beginPath(); c.arc(bx,by,b.r,0,6.283); c.fill(); c.stroke();
        c.fillStyle='rgba(255,255,255,'+(0.8*a).toFixed(3)+')';
        c.beginPath(); c.arc(bx-b.r*0.35,by-b.r*0.35,Math.max(0.8,b.r*0.22),0,6.283); c.fill();
      }
    }

    function frame(now){
      if(finished) return;
      var t=now-self._introV2Start+skipShift, ts=t/1000;
      c.setTransform(dpr,0,0,dpr,0,0);
      c.clearRect(0,0,W,H);
      var k=inOut((t-T.cross0)/(T.cross1-T.cross0));
      var amp=(mobile?7:11)*(0.4+0.6*Math.sin(Math.PI*cl((t-T.cross0)/(T.cross1-T.cross0))));
      var wl=H*1.12-k*H*1.34;                                // the waterline: below the frame -> above it
      var bgA=1-smooth(T.reveal,T.reveal+900,t);             // the opaque water gives way to the real site
      if(t<T.cross0){
        drawAbove(t,ts);
      } else if(t<T.cross1+60){
        // ---- the crossing: above the line the sea we were looking at, below it the water we are entering
        c.save(); clipAbove(wl,ts,amp); drawAbove(t,ts);
        // spray thrown up off the line
        for(var di=0;di<D.length;di++){
          var dr=D[di], fk=(t-dr.t0)/700; if(fk<0||fk>1) continue;
          var sx=dr.x*W+dr.vx*fk*W*0.2, sy=lineY(dr.x*W,wl,ts,amp)+dr.vy*fk*H*0.22+fk*fk*H*0.12;
          c.fillStyle='rgba(255,255,255,'+(0.85*(1-fk)).toFixed(3)+')';
          c.beginPath(); c.arc(sx,sy,dr.r,0,6.283); c.fill();
        }
        c.restore();
        c.save(); clipBelow(wl,ts,amp); drawUnder(t,ts,wl,1); drawBubbles(t,ts,1); c.restore();
        // the meniscus: a bright rippling edge with a soft halo on both sides
        c.save();
        c.beginPath(); traceLine(wl,ts,amp);
        c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=26; c.filter='blur(8px)'; c.stroke(); c.filter='none';
        c.beginPath(); traceLine(wl,ts,amp);
        c.strokeStyle='rgba(255,255,255,.92)'; c.lineWidth=2.4; c.stroke();
        c.restore();
      } else {
        // ---- below: look up at the bright surface drifting away; its light becomes the site's sky
        var surfaceY=wl-ease((t-T.cross1)/1600)*H*0.25;
        if(bgA>0) drawUnder(t,ts,surfaceY,bgA);
        drawBubbles(t,ts,1-smooth(T.reveal+300,T.settled-200,t));
      }
      // ---- the site takes over underneath; Home rises out of the blue and settles
      if(!released&&t>=T.reveal){
        released=true;
        self.sky.style.background='linear-gradient(180deg,'+homeSky[0]+' 0%,'+homeSky[1]+' 100%)';
        self._layoutGeometryDirty=true; self._sceneDirty=true; self.introDone=true;
        cv.style.pointerEvents='none';
      }
      if(released) setHome(ease((t-T.reveal)/(T.settled-T.reveal)));
      if(!chromeShown&&t>=T.settled-900){ chromeShown=true; chrome.forEach(function(el){ el.style.opacity=''; }); }
      if(t>=T.settled){
        finished=true; setHome(1); cv.remove();
        setTimeout(function(){ chrome.forEach(function(el){ el.style.transition=''; }); },1000);
        window.removeEventListener('wheel',skip); window.removeEventListener('touchstart',skip); window.removeEventListener('keydown',skip); cv.removeEventListener('pointerdown',skip);
        try{ sessionStorage.setItem('tt_intro_home_v5','1'); }catch(e){}
        return;
      }
      requestAnimationFrame(frame);
    }
    // any input: jump straight to the dive
    var skip=function(){ var t=performance.now()-self._introV2Start+skipShift; if(t<T.cross0-150) skipShift+=T.cross0-150-t; };
    window.addEventListener('wheel',skip,{passive:true}); window.addEventListener('touchstart',skip,{passive:true}); window.addEventListener('keydown',skip); cv.addEventListener('pointerdown',skip);
    this.introDone=false;
    this._introV2Start=performance.now();
    requestAnimationFrame(frame);
  },
};
