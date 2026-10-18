// Bridges: the five connective lines between chapters - their visuals, playback, pinning and hand-off to the next chapter.
// Methods of Component (src/app/component.js); the build attaches them with Object.assign.
var ComponentBridges = {
  stopBridgeVisual(bg){
    if(!bg) return;
    bg._playing=false;
    var outer=bg._bridgeOuter||(bg.closest?bg.closest('[data-story-bridge-wrap]'):null);
    if(!bg._seen){
      if(bg._bridgeStage) bg._bridgeStage.style.display='none';
      if(bg._visual) bg._visual.style.opacity='0';
    }
    bg.style.willChange='auto';
    if(bg._kicker) bg._kicker.style.willChange='auto';
    if(bg._words){
      for(var i=0;i<bg._words.length;i++){
        bg._words[i].style.willChange='auto';
        bg._words[i].style.filter='none';
      }
    }
  },

  // audio
  bridgeTypeForIndex(i){
    var bridge = this.BRIDGES && this.BRIDGES[i];
    var id = String((bridge && bridge.id) || '').toLowerCase();
    var byId = {
      'home-projects': 'prologue',
      'projects-members': 'gather',
      'members-works': 'bloom',
      'works-news': 'rise',
      'news-contact': 'page'
    };
    return byId[id] || ['prologue','gather','bloom','rise','page'][i] || 'gather';
  },

  bridgePhraseForIndex(i){
    var bridge = this.BRIDGES && this.BRIDGES[i];
    if(bridge && bridge.text) return bridge.text;
    var l=this.lang||'kr';
    if(l==='kr') return (this._bridgeKR&&this._bridgeKR[i])||'';
    var T=[
      {en:'It begins with a single line', jp:'It begins with a single line'},
      {en:'Two worlds where the tones dwell', jp:'Two worlds where the tones dwell'},
      {en:'And so, we gathered', jp:'And so, we gathered'},
      {en:'It blossomed into a piece of music', jp:'It blossomed into a piece of music'},
      {en:'It reaches hearts far away', jp:'It reaches hearts far away'},
      {en:'The last page is yours', jp:'The last page is yours'}
    ][i];
    return T ? (T[l]||'') : '';
  },

  bridgeMobileLinesForIndex(i){
    var bridge = this.BRIDGES && this.BRIDGES[i];
    var l = this.lang || 'kr';
    var localized = bridge && bridge.translations && bridge.translations[l];
    var source = localized && Array.isArray(localized.mobileLines) ? localized.mobileLines : (bridge && Array.isArray(bridge.mobileLines) ? bridge.mobileLines : null);
    if(!source || !source.length){
      var phrase = (localized && localized.text) || this.bridgePhraseForIndex(i) || '';
      source = [{ text: phrase, indent: 0 }];
    }
    var out=[];
    for(var mi=0; mi<source.length; mi++){
      var item=source[mi] || {};
      var text = item.text == null ? '' : String(item.text);
      if(!text.trim()) continue;
      var indent = parseInt(item.indent, 10);
      if(!isFinite(indent)) indent = 0;
      indent = Math.max(-2, Math.min(2, indent));
      out.push({ text:text, indent:indent });
    }
    return out.length ? out : [{ text:String(this.bridgePhraseForIndex(i) || ''), indent:0 }];
  },

  buildBridgeVisual(bg, type, idx){
    var outer = bg.closest ? bg.closest('[data-story-bridge-wrap]') : bg.parentElement;
    if(!outer) return null;
    outer.classList.add('tt-bridge-pinned');

    var stage = outer._bridgeStage;
    if(!stage){
      stage=document.createElement('div');
      stage.className='tt-bridge-pin-stage';
      while(outer.firstChild) stage.appendChild(outer.firstChild);
      outer.appendChild(stage);
      outer._bridgeStage=stage;
    }
    bg._bridgeOuter=outer; bg._bridgeStage=stage;
    bg.style.position='relative'; bg.style.zIndex='4';
    if(bg._visual && bg._visual.parentNode) bg._visual.parentNode.removeChild(bg._visual);
    Array.from(stage.children).forEach(function(ch){
      if(ch && ch.classList && ch.classList.contains('tt-bridge-visual')) ch.remove();
    });
    bg._visual=null; bg._visualItems=null;

    var v=document.createElement('div');
    v.className='tt-bridge-visual tt-bridge-visual--'+type;
    v.setAttribute('aria-hidden','true');
    v.dataset.bridgeType=type;
    var firstLine=stage.querySelector('[data-bridge-line]');
    stage.insertBefore(v, firstLine || bg);
    var items=[];
    var lightVisual = window.innerWidth <= 760;
    // Five motifs, one per crossing. Soft light only: no rings, rays or hairlines.
    var PAL=['127,227,238','255,159,184','255,214,140','185,166,255','157,240,200'];
    function orb(cls, size, rgb){ var o=document.createElement('i'); o.className=cls; if(size) o.style.setProperty('--s',size+'px'); if(rgb) o.style.setProperty('--c',rgb); v.appendChild(o); items.push(o); return o; }
    function note(glyph, size){ var n=document.createElement('b'); n.className='tb-note'; n.textContent=glyph; n.style.setProperty('--s',size+'px'); v.appendChild(n); items.push(n); return n; }
    if(type==='prologue'){
      // HOW WE DIVE: the three steps of the journey light up one after another, joined by a thread of light
      var steps=document.createElement('div'); steps.className='tt-prologue-steps'; v.appendChild(steps);
      ['TALE','TONE','MUSIC'].forEach(function(word, si){
        if(si){ var link=document.createElement('i'); link.className='tt-prologue-link'; link._step=si-0.5; steps.appendChild(link); items.push(link); }
        var st=document.createElement('span'); st.className='tt-prologue-step'; st.textContent=word; st._step=si; steps.appendChild(st); items.push(st);
      });
    } else if(type==='gather'){
      // LISTEN -> COLOUR: pale story-lights drift in from every side and gather close;
      // at the moment of listening each takes a colour of its own, then they settle around the words
      var iris=orb('tb-glow tb-iris',lightVisual?300:520); iris._kind='iris';
      for(var gi=0, gN=lightVisual?22:40; gi<gN; gi++){
        var go=orb('tb-orb',(lightVisual?10:14)+Math.random()*(lightVisual?12:20),'255,255,255');
        go._kind='g'; go._a=Math.random()*6.283; go._r=0.55+Math.random()*0.5; go._d=Math.random()*0.16; go._ph=Math.random()*6.283; go._col=PAL[gi%PAL.length];
        if(lightVisual){ go._fx=(Math.random()*2-1)*0.9; go._fy=(Math.random()<0.5?-1:1)*(0.62+Math.random()*0.34); }
        else { go._fx=(Math.random()<0.5?-1:1)*(0.62+Math.random()*0.34); go._fy=(Math.random()*2-1)*0.8; }
      }
    } else if(type==='bloom'){
      // TOUCH -> SOUND -> SONG: a warm light comes down to the fingertips, opens into a line of sound,
      // and the sound lifts away as notes
      var warm=orb('tb-glow tb-warm',lightVisual?220:320); warm._kind='warm';
      var touch=orb('tb-orb tb-touch',lightVisual?22:28,'255,236,190'); touch._kind='touch';
      for(var bi=0, bN=lightVisual?15:23; bi<bN; bi++){
        var t2=bi/(bN-1), from=t2<0.5?PAL[0]:PAL[2], to=t2<0.5?PAL[2]:PAL[1], tt=t2<0.5?t2*2:(t2-0.5)*2;
        var fa=from.split(','), ta=to.split(','), col=[0,1,2].map(function(c){ return Math.round(+fa[c]+(+ta[c]-fa[c])*tt); }).join(',');
        var bo=orb('tb-orb',12,col); bo._kind='bar'; bo._i=bi; bo._n=bN; bo._ph=Math.random()*0.8; bo._lift=0.5+Math.random()*0.6;
      }
      for(var ni=0, nN=lightVisual?5:8; ni<nN; ni++){ var bn=note(ni%2?'♪':'♫',18+Math.random()*14); bn._kind='note'; bn._x=(Math.random()*2-1)*0.75; bn._d=Math.random()*0.2; bn._ph=Math.random()*6.283; }
    } else if(type==='rise'){
      // THE SONG RISES: bubbles, little lights and notes ride the current up
      for(var ri=0, rN=lightVisual?22:40; ri<rN; ri++){ var bub=orb('tb-bub',6+Math.pow(Math.random(),2)*26); bub._kind='up'; bub._size=parseFloat(bub.style.getPropertyValue('--s')); }
      for(var li=0, lN=lightVisual?10:20; li<lN; li++){ var lo=orb('tb-orb',8+Math.random()*12,li%2?PAL[0]:PAL[2]); lo._kind='up'; lo._size=12; }
      for(var rn=0, rnN=lightVisual?3:6; rn<rnN; rn++){ var rnote=note(rn%2?'♪':'♫',16+Math.random()*10); rnote._kind='up'; rnote._size=20; }
      items.forEach(function(it){ if(it._kind!=='up') return; it._x=(Math.random()*2-1)*0.95; it._d=Math.random()*0.3; it._sp=0.85+Math.random()*0.5; it._ph=Math.random()*6.283; });
    } else if(type==='page'){
      // YOUR TURN: a blank page of light opens; the first note falls onto it, the page wakes,
      // and the music begins to rise from it
      var page=document.createElement('i'); page.className='tb-page'; page._kind='page'; v.appendChild(page); items.push(page);
      var first=note('♪',lightVisual?30:40); first._kind='main'; first.classList.add('tb-note-main');
      for(var pi=0, pN=lightVisual?10:16; pi<pN; pi++){ var pm=orb('tb-orb',6+Math.random()*8,'255,226,170'); pm._kind='burst'; pm._a=-Math.PI*(0.05+0.9*Math.random()); pm._dist=(lightVisual?60:90)+Math.random()*(lightVisual?90:150); pm._d=Math.random()*0.06; }
      for(var ei=0, eN=lightVisual?3:5; ei<eN; ei++){ var em=note(ei%2?'♪':'♫',14+Math.random()*8); em._kind='ember'; em._x=(Math.random()*2-1); em._ph=Math.random(); }
    }
    bg._vW2=(v.clientWidth||1000)/2; bg._vH2=(v.clientHeight||420)/2;
    bg._visual=v; bg._visualItems=items;
    return v;
  },

  setBridgeVisual(bg, type, prog, exit, time){
    var v=bg._visual; if(!v) return;
    // #1 impact envelope: a sharp gaussian at each motif's physical hit, drives camera + text kick
    var impEnv=0;
    if(type==='gather') impEnv=0.8*Math.exp(-Math.pow((prog-0.5)/0.02,2));
    else if(type==='page') impEnv=Math.exp(-Math.pow((prog-0.50)/0.014,2))+0.5*Math.exp(-Math.pow((prog-0.56)/0.011,2));
    else if(type==='bloom') impEnv=0.5*Math.exp(-Math.pow((prog-0.30)/0.02,2))+0.8*Math.exp(-Math.pow((prog-0.50)/0.025,2));
    else if(type==='rise') impEnv=0.25*Math.exp(-Math.pow((prog-0.6)/0.04,2));
    bg._imp=impEnv;
    var show=this.smooth(0.00,0.055,prog)*(1-this.smooth(0.965,1.0,prog));
    v.style.opacity=(show*(1-exit)).toFixed(3);
    v.style.setProperty('--aura',(0.38+0.62*show).toFixed(3));
    var bridgeScale=(0.985+0.025*this.smooth(0.12,0.72,prog))*(window.innerWidth<=760?0.86:1);
    v.style.transform='translate(-50%,-50%) translate3d(0,'+(-10*exit).toFixed(1)+'px,0) scale('+bridgeScale.toFixed(3)+')';
    var items=bg._visualItems||[];
    var sm=this.smooth.bind(this), cl=this.cl.bind(this);
    var ease=function(k){ return 1-Math.pow(1-k,3); };
    var bump=function(at,w){ return Math.exp(-Math.pow((prog-at)/w,2)); };
    var mixc=function(a,b,t){ var A=a.split(','),B=b.split(','); return Math.round(+A[0]+(B[0]-A[0])*t)+','+Math.round(+A[1]+(B[1]-A[1])*t)+','+Math.round(+A[2]+(B[2]-A[2])*t); };
    var W2=bg._vW2||500, H2=bg._vH2||210, live=1-exit;
    var put=function(el,x,y,s,a,rot){ el.style.opacity=Math.max(0,a).toFixed(3); el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)'+(rot?' rotate('+rot.toFixed(1)+'deg)':'')+' scale('+s.toFixed(3)+')'; };
    if(type==='prologue'){
      for(var pi=0;pi<items.length;pi++){
        var ps=items[pi], isLink=String(ps.className).indexOf('link')>-1, at=0.1+ps._step*0.17;
        var pon=sm(at,at+0.12,prog)*live;
        ps.style.opacity=(pon*(isLink?0.7:1)).toFixed(3);
        ps.style.transform=isLink?'scaleX('+pon.toFixed(3)+')':'translateY('+((1-pon)*12).toFixed(1)+'px)';
      }
    } else if(type==='gather'){
      var tint=sm(0.46,0.54,prog), spread=ease(cl((prog-0.5)/0.34,0,1));
      for(var g=0; g<items.length; g++){
        var it=items[g];
        if(it._kind==='iris'){
          it.style.opacity=(sm(0.4,0.5,prog)*(0.55+0.45*bump(0.5,0.08))*live).toFixed(3);
          it.style.setProperty('--r',((time*20)%360).toFixed(1)+'deg');
          it.style.transform='scale('+(0.55+0.55*sm(0.4,0.58,prog)).toFixed(3)+')';
          continue;
        }
        var k1=ease(cl((prog-0.06-it._d)/0.42,0,1));
        var ang=it._a+(1-k1)*1.6+time*0.1;
        var x=Math.cos(ang)*W2*it._r*(1-k1)+Math.cos(it._a*3)*W2*0.07*k1;
        var y=Math.sin(ang)*H2*it._r*1.1*(1-k1)+Math.sin(it._a*2)*H2*0.12*k1;
        x=x*(1-spread)+(it._fx*W2+Math.sin(time*0.6+it._ph)*14)*spread;
        y=y*(1-spread)+(it._fy*H2+Math.cos(time*0.5+it._ph)*12)*spread;
        it.style.setProperty('--c',mixc('235,248,252',it._col,tint));
        put(it,x,y,0.7+0.5*tint,sm(0.06,0.2,prog)*(0.4+0.6*tint)*live);
      }
    } else if(type==='bloom'){
      var fall=ease(cl((prog-0.06)/0.24,0,1)), barsIn=ease(cl((prog-0.28)/0.16,0,1));
      var amp=sm(0.3,0.44,prog)*(1-0.6*sm(0.56,0.78,prog)), lift=ease(cl((prog-0.5)/0.42,0,1));
      for(var b=0; b<items.length; b++){
        var e=items[b];
        if(e._kind==='warm'){ e.style.opacity=((sm(0.1,0.3,prog)*0.45+0.4*bump(0.5,0.06))*(1-sm(0.72,0.96,prog))*live).toFixed(3); e.style.transform='scale('+(0.7+0.5*sm(0.1,0.5,prog)).toFixed(3)+')'; }
        else if(e._kind==='touch'){ var hit=bump(0.3,0.025); put(e,0,-H2*1.05*(1-fall)+Math.sin(time*2.6)*3*fall,1+0.9*hit,sm(0.06,0.14,prog)*(1-sm(0.48,0.6,prog))*live); }
        else if(e._kind==='bar'){
          var wave=Math.sin(time*5.5+e._i*0.62+e._ph), env=0.45+0.55*Math.sin(e._i/(e._n-1)*Math.PI);
          var bx=(e._i-(e._n-1)/2)*(W2*1.35/(e._n-1))*barsIn;
          var by=wave*H2*0.34*amp*env-lift*H2*e._lift;
          put(e,bx,by,0.8+0.9*Math.abs(wave)*amp*env,sm(0.28,0.36,prog)*(1-sm(0.7,0.94,prog))*0.75*live);
        } else if(e._kind==='note'){
          var nk=cl((prog-0.5-e._d)/0.45,0,1);
          put(e,e._x*W2+Math.sin(time*1.6+e._ph)*16,H2*0.25-nk*H2*1.45,0.9+0.2*nk,Math.sin(nk*Math.PI)*0.9*live,Math.sin(time*1.4+e._ph)*12);
        }
      }
    } else if(type==='rise'){
      var current=Math.sin(prog*3.1)*W2*0.05;
      for(var r=0; r<items.length; r++){
        var u=items[r];
        var rk=cl((prog-0.03-u._d)/0.72,0,1);
        var ry=H2*1.08-H2*2.25*Math.pow(rk,1.12)*u._sp;
        var rx=u._x*W2+Math.sin(time*(0.9+u._sp)+u._ph)*(8+u._size/3)+current*rk;
        var height=(H2*1.08-ry)/(H2*2.1);
        put(u,rx,ry,1+0.35*sm(0.82,1,height),sm(0,0.08,rk)*(1-sm(0.84,1,height))*0.85*live);
      }
    } else if(type==='page'){
      var land=sm(0.5,0.53,prog), impact=bump(0.5,0.018);
      for(var q=0; q<items.length; q++){
        var p2=items[q];
        if(p2._kind==='page'){ p2.style.opacity=((sm(0.08,0.36,prog)*0.7+0.45*bump(0.51,0.05))*live).toFixed(3); p2.style.transform='scale('+(0.92+0.08*sm(0.08,0.4,prog)+0.03*impact).toFixed(3)+')'; }
        else if(p2._kind==='main'){
          var fk=cl((prog-0.22)/0.28,0,1);
          var bounce=prog>0.5?Math.exp(-(prog-0.5)*26)*Math.abs(Math.sin((prog-0.5)*64))*18:0;
          var ny=-H2*0.95*(1-fk*fk)-bounce+Math.sin(time*2.4)*3*land;
          put(p2,Math.sin(fk*6)*10*(1-fk),ny,(1+0.12*land)*(1+0.25*impact),sm(0.2,0.28,prog)*live,-14*(1-fk)+4*Math.sin(time*1.8)*land);
        } else if(p2._kind==='burst'){
          var bk=ease(cl((prog-0.5-p2._d)/0.34,0,1));
          put(p2,Math.cos(p2._a)*p2._dist*bk,Math.sin(p2._a)*p2._dist*0.7*bk,1-0.4*bk,sm(0.5,0.52,prog)*(1-bk)*live);
        } else if(p2._kind==='ember'){
          var ek=(time*0.18+p2._ph)%1;
          put(p2,p2._x*W2*0.3+Math.sin(time+p2._ph*6)*12,-ek*H2*0.85,0.9,Math.sin(ek*Math.PI)*0.7*land*live,Math.sin(time+p2._ph*6)*10);
        }
      }
    }
  },

  startBridge(index){
    if(this._bridgeRun || this._bridgeSeen[index] || this._bridgeBypassed[index] || this._bridgeNavTarget || !this.scroller) return;
    var bg=this.bridges[index], outer=bg&&(bg._bridgeOuter||bg.closest('[data-story-bridge-wrap]'));
    if(!outer) return;
    // One owner: lock native scrolling BEFORE aligning, then run animation + reading hold.
    var copy=this.bridgeMobileLinesForIndex(index).map(line=>line.text||'').join('');
    var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this._reduceMotion=reduced;
    var style=this.scroller.style, saved={};
    ['overflow-y','touch-action','overscroll-behavior','scroll-behavior','scroll-snap-type'].forEach(key=>{
      saved[key]=[style.getPropertyValue(key),style.getPropertyPriority(key)];
    });
    this._bridgeRun={index:index,phase:'playing',startedAt:null,duration:reduced?700:1200,
      hold:Math.min(2600,Math.max(1400,copy.trim().length*22)),saved:saved};
    outer.setAttribute('data-bridge-active','');
    style.setProperty('overflow-y','hidden','important');
    style.setProperty('touch-action','none','important');
    style.setProperty('overscroll-behavior','none','important');
    style.setProperty('scroll-behavior','auto','important');
    style.setProperty('scroll-snap-type','none','important'); // chapter snapping (phones) must not fight the lock
    this.scroller.dataset.bridgePhase='playing';
    this.scroller.dataset.bridgeIndex=String(index);
    this._fastScrollUntil=0;
    clearTimeout(this._mobileScrollIdleTimer);
    clearTimeout(this._chapterNavCorrect1); clearTimeout(this._chapterNavCorrect2);
    clearTimeout(this._routeLandingCorrect1); clearTimeout(this._routeLandingCorrect2); clearTimeout(this._routeLandingCorrect3);
    document.body.classList.remove('tt-mobile-scroll-active'); this._fastMobileState=false;
    this.scroller.scrollTo({top:outer.offsetTop,behavior:'auto'});
    this._bridgeScrollTop=this.scroller.scrollTop;
    this._sceneDirty=true;
    window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_PRELOAD',{detail:{chapter:['projects','members','works','news','contact'][index]}}));
  },

  // Momentum (touch flicks, trackpad inertia, a wheel smooth-scroll already in flight) can keep
  // moving the scroller after the lock engages; hold it on the bridge until the handoff takes over.
  _pinBridgeAnchor(){
    var run=this._bridgeRun;
    if(!run||run.phase==='advancing'||!this.scroller) return;
    var bg=this.bridges[run.index];
    var outer=bg&&(bg._bridgeOuter||(bg.closest?bg.closest('[data-story-bridge-wrap]'):null));
    if(!outer) return;
    var anchor=outer.offsetTop;
    if(Math.abs(this.scroller.scrollTop-anchor)>1){
      this.scroller.scrollTo({top:anchor,behavior:'auto'});
      this._bridgeScrollTop=this.scroller.scrollTop;
      this._sceneDirty=true;
    }
  },

  // Bottom-centre progress for a locked bridge, so a held page never looks frozen.
  _setBridgeProgress(run){
    var el=this._bridgeProgressEl||(this._bridgeProgressEl=document.getElementById('tt-bridge-progress'));
    if(!el) return;
    if(!run||run.startedAt==null){ if(el._shown){ el.style.opacity='0'; el._shown=false; } return; }
    if(!el._shown){
      el.style.opacity='1'; el._shown=true;
      var label=el.querySelector('span');
      if(label) label.textContent={kr:'스크롤하면 바로 넘어갑니다',en:'Scroll to move on',jp:'スクロールで次へ進みます'}[this.lang||'kr'];
    }
    el.style.setProperty('--bridge-p',this.cl((performance.now()-run.startedAt)/(run.duration+run.hold),0,1).toFixed(3));
  },

  releaseBridge(){
    var run=this._bridgeRun;
    if(!run) return;
    this._setBridgeProgress(null);
    this._bridgeRun=null;
    this._bridgeInputCutoff=performance.now();
    // On phones a played bridge shrinks to a short band once released (works.css); keep the chapter the
    // handoff just reached where it is instead of letting it jump up by the difference.
    // (Measured on the next chapter: the browser's own scroll anchoring sometimes corrects part of it already.)
    document.querySelectorAll('[data-bridge-active]').forEach(outer=>{
      var next=outer.nextElementSibling, before=next?next.getBoundingClientRect().top:0;
      outer.removeAttribute('data-bridge-active');
      if(!next||!this.scroller) return;
      var moved=next.getBoundingClientRect().top-before;
      if(Math.abs(moved)>0.5) this.scroller.scrollTop=Math.max(0,this.scroller.scrollTop+moved);
    });
    if(this.scroller){
      Object.keys(run.saved).forEach(key=>{
        var value=run.saved[key];
        if(value[0]) this.scroller.style.setProperty(key,value[0],value[1]);
        else this.scroller.style.removeProperty(key);
      });
      delete this.scroller.dataset.bridgePhase;
      delete this.scroller.dataset.bridgeIndex;
      this._bridgeScrollTop=this.scroller.scrollTop;
    }
    this._sceneDirty=true;
  },

  advanceBridge(now){
    var run=this._bridgeRun;
    if(!run) return;
    var targets=[['c-projects','/story-types/'],['c-members','/members/'],['c-works','/works/'],['c-news','/news/'],['c-contact','/contact/']];
    var route=targets[run.index], target=route&&document.getElementById(route[0]);
    if(!target){ this.releaseBridge(); return; }
    if(run.phase!=='advancing'){
      run.phase='advancing'; run.advanceAt=now; run.from=this.scroller.scrollTop;
      this.scroller.dataset.bridgePhase='advancing';
      this._bridgeSeen[run.index]=true;
      try{sessionStorage.setItem('tt_bridge_seen_v2',JSON.stringify(Object.keys(this._bridgeSeen).map(Number)));}catch(_){}
      if(route){
        this._chapterTarget=route[0];
        if(window.history&&window.history.pushState){ try{ window.history.pushState(null,'',this._langPath(route[1])); }catch(_){} }
        this._applySeoForCurrentPage();
        if(route[0]!=='c-works') this.pauseWorksAudio();
      }
    }
    // Keep the lock through the handoff; input must not interrupt a native smooth scroll.
    var p=this._reduceMotion?1:this.cl((now-run.advanceAt)/450,0,1), eased=1-Math.pow(1-p,3);
    var nextTop=run.from+(target.offsetTop-run.from)*eased;
    if(Math.abs(this.scroller.scrollTop-nextTop)>0.5) this.scroller.scrollTo({top:nextTop,behavior:'auto'});
    this._sceneDirty=true;
    if(p>=1 && now-run.advanceAt>=(this._reduceMotion?350:650) && now-(run.lastInputAt||run.advanceAt)>=350) this.releaseBridge();
  },

  bypassBridges(targetId){
    this.releaseBridge();
    this._bridgeBypassed={};
    var target=targetId&&document.getElementById(targetId), targetTop=target?target.offsetTop:(this.scroller?this.scroller.scrollTop:0);
    this._bridgeNavTarget=target&&Math.abs(this.scroller.scrollTop-targetTop)>3?targetId:null;
    this._bridgeNavAt=performance.now();
    (this.bridges||[]).forEach((bg,i)=>{
      var outer=bg._bridgeOuter||(bg.closest?bg.closest('[data-story-bridge-wrap]'):null);
      var past=!!outer&&outer.offsetTop<=targetTop+2;
      if(past) this._bridgeBypassed[i]=true;
      bg._playing=false; bg._seen=!!(this._bridgeSeen[i]||past); bg._ready=false;
      if(outer) outer.classList.toggle('tt-bridge-seen',bg._seen);
      if(!bg._seen) this.stopBridgeVisual(bg);
    });
    this._bridgeScrollTop=targetTop;
    this._sceneDirty=true;
  },

  fitBridgeCopy(bg){
    if(!bg) return;
    var isMobile = window.innerWidth <= 760;
    if(!isMobile){
      bg.style.width='min(1180px,92vw)';
      bg.style.maxWidth='min(1180px,92vw)';
      bg.style.marginLeft='auto';
      bg.style.marginRight='auto';
      bg.style.textAlign='center';
      bg.style.alignSelf='center';
      bg.style.setProperty('font-size','clamp(28px,4.4vw,68px)');
      bg.style.setProperty('line-height','1.16');
      bg.style.whiteSpace='pre';
      bg.style.wordBreak='keep-all';
      bg.style.overflowWrap='normal';
      bg.style.textWrap='nowrap';
      bg._fitVw = window.innerWidth;
      return;
    }
    if(bg._mobileLinesMode){
      bg.style.setProperty('width','min(620px, calc(100vw - 52px))','important');
      bg.style.setProperty('max-width','min(620px, calc(100vw - 52px))','important');
      bg.style.marginLeft='auto';
      bg.style.marginRight='auto';
      bg.style.textAlign='center';
      bg.style.alignSelf='center';
      bg.style.setProperty('font-size','clamp(26px, 7vw, 31px)','important');
      bg.style.setProperty('line-height','1.16','important');
      bg.style.setProperty('letter-spacing','0','important');
      bg.style.setProperty('white-space','normal','important');
      bg.style.setProperty('word-break','keep-all','important');
      bg.style.setProperty('overflow-wrap','normal','important');
      bg.style.setProperty('text-wrap','balance','important');
      bg._fitVw = window.innerWidth;
      return;
    }
    var available = Math.max(260, window.innerWidth - 38);
    var base = Math.min(40, Math.max(22, window.innerWidth * 0.082));
    bg.style.setProperty('max-width','none','important');
    bg.style.setProperty('font-size',base.toFixed(1)+'px','important');
    bg.style.setProperty('line-height','1.18','important');
    bg.style.setProperty('white-space','pre','important');
    bg.style.setProperty('word-break','keep-all','important');
    bg.style.setProperty('overflow-wrap','normal','important');
    bg.style.setProperty('text-wrap','nowrap','important');
    var measured = bg.scrollWidth || bg.getBoundingClientRect().width || 0;
    if(measured > available){
      var fitted = Math.max(18, base * (available / measured));
      bg.style.setProperty('font-size',fitted.toFixed(1)+'px','important');
      measured = bg.scrollWidth || bg.getBoundingClientRect().width || 0;
      if(measured > available){
        bg.style.setProperty('max-width',available+'px','important');
        bg.style.setProperty('white-space','pre-wrap','important');
        bg.style.setProperty('text-wrap','balance','important');
      }
    }
    bg._fitVw = window.innerWidth;
  },

  updateBridges(vhR){
    if(!this.bridges) return;
    // self-heal: a React re-render can replace bridge nodes, leaving our references detached
    if(this.bridges.length && !document.contains(this.bridges[0])){
      this.bridges = Array.from(document.querySelectorAll('[data-bridge]'));
      this.bridges.forEach(function(el){ el.style.transition='none'; el.style.willChange='opacity,transform,letter-spacing'; });
    }
    var mobileBridgeMode = window.innerWidth <= 760;
    var now=performance.now();
    if(this._bridgeRun && this._bridgeRun.phase==='advancing') this.advanceBridge(now);
    var fastMobile=this.isFastMobileScroll(now);
    // Bridges play on the way down only. Readers who come back up (or land on a later chapter and scroll
    // back) pass a bridge in its finished state instead of being held by it. The last real direction is
    // kept, so stopping on the bridge does not count as going down.
    // A direction only counts after a clear 48px, so small nudges either way (a scroll-snap settling, a
    // bounce) do not flip it. Until the reader has gone up, the direction is "down".
    if(this.scroller&&!this._bridgeRun){
      var st=this.scroller.scrollTop;
      if(this._bridgeScrollDir===-1){
        this._bridgeTurnAt=Math.min(this._bridgeTurnAt,st);
        if(st>this._bridgeTurnAt+48){ this._bridgeScrollDir=1; this._bridgeTurnAt=st; }
      } else {
        this._bridgeTurnAt=this._bridgeTurnAt==null?st:Math.max(this._bridgeTurnAt,st);
        if(st<this._bridgeTurnAt-48){ this._bridgeScrollDir=-1; this._bridgeTurnAt=st; }
      }
      this._bridgeScrollPrev=st;
    }
    for(var gi=0;gi<this.bridges.length;gi++){
      var bg=this.bridges[gi];
      var outer=bg._bridgeOuter || (bg.closest ? bg.closest('[data-story-bridge-wrap]') : null) || (bg.parentElement && bg.parentElement.classList && bg.parentElement.classList.contains('tt-bridge-pin-stage') ? bg.parentElement.parentElement : bg.parentElement);
      if(!outer) continue;
      if(this._bridgeRun && this._bridgeRun.index===gi) outer.setAttribute('data-bridge-active','');
      var rect=outer.getBoundingClientRect();
      bg._seen=!!(this._bridgeSeen[gi]||this._bridgeBypassed[gi]);
      outer.classList.toggle('tt-bridge-seen',bg._seen);
      var nearBridge = mobileBridgeMode ? (rect.bottom >= -vhR*0.12 && rect.top <= vhR*1.12) : (rect.bottom >= -vhR*0.35 && rect.top <= vhR*1.35);
      var farDuringFastMobile = !bg._seen && !this._bridgeRun && fastMobile && (rect.bottom < vhR*0.22 || rect.top > vhR*0.78);
      if(!nearBridge || farDuringFastMobile){
        if(!nearBridge&&bg._seen) bg._ready=false;
        this.stopBridgeVisual(bg);
        continue;
      }
      if(bg._bridgeStage && bg._bridgeStage.style.display==='none') bg._bridgeStage.style.display='';
      if(bg._words && !!bg._mobileLinesMode !== mobileBridgeMode){ bg._words=null; bg.innerHTML=''; bg._mobileLinesMode=false; bg._fitVw=null; }
      if(mobileBridgeMode){
        bg.style.whiteSpace='normal';
        bg.style.wordBreak='keep-all';
        bg.style.overflowWrap='normal';
        bg.style.textWrap='balance';
      } else {
        bg.style.whiteSpace='pre';
        bg.style.wordBreak='keep-all';
        bg.style.overflowWrap='normal';
        bg.style.textWrap='nowrap';
      }
      bg.style.willChange='opacity,transform,letter-spacing';
      if(bg._kicker) bg._kicker.style.willChange='opacity,transform,letter-spacing';
      var type=this.bridgeTypeForIndex(gi);
      if(!bg._words){
        var mobileBridge = window.innerWidth <= 760;
        var txt=this.bridgePhraseForIndex(gi) || bg.textContent.replace(/\s+/g,' ').trim();
        var plainLabel = String(txt).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
        bg.setAttribute('aria-label', plainLabel);
        bg.innerHTML=''; bg._words=[]; bg._mobileLinesMode=mobileBridge;
        if(mobileBridge){
          var mobileWrap=document.createElement('span');
          mobileWrap.className='tt-bridge-mobile-text';
          mobileWrap.setAttribute('aria-hidden','true');
          var mobileLines=this.bridgeMobileLinesForIndex(gi);
          for(var li=0; li<mobileLines.length; li++){
            var lineData=mobileLines[li] || {};
            var line=document.createElement('span');
            line.className='tt-mobile-bridge-line';
            line.setAttribute('data-indent', String(lineData.indent || 0));
            var inner=document.createElement('span');
            inner.textContent = lineData.text || '';
            inner.style.cssText='display:inline-block;max-width:100%;white-space:nowrap;will-change:transform,opacity;word-break:keep-all;overflow-wrap:normal;';
            line.appendChild(inner);
            mobileWrap.appendChild(line);
            bg._words.push(inner);
          }
          bg.appendChild(mobileWrap);
        } else {
          var desktopWrap=document.createElement('span');
          desktopWrap.className='tt-bridge-desktop-text';
          var richBridge = this.looksLikeRichText(txt) || /[\r\n\t]| {2,}/.test(String(txt));
          if(richBridge){
            var rs=document.createElement('span');
            rs.innerHTML = this.looksLikeRichText(txt) ? this.sanitizeRichHtml(txt) : this.plainTextHtml(txt);
            rs.style.cssText='display:inline-block;max-width:none;white-space:pre;will-change:transform,opacity;word-break:keep-all;overflow-wrap:normal;';
            desktopWrap.appendChild(rs);
            bg._words.push(rs);
          } else {
            var words=this.normalizedAnimatedText(txt).split(' ');
            for(var wi=0; wi<words.length; wi++){
              var s=document.createElement('span');
              s.textContent=words[wi];
              s.style.cssText='display:inline-block;max-width:none;white-space:pre;will-change:transform,opacity;word-break:keep-all;overflow-wrap:normal;';
              desktopWrap.appendChild(s); if(wi<words.length-1) desktopWrap.appendChild(document.createTextNode(' '));
              bg._words.push(s);
            }
          }
          bg.appendChild(desktopWrap);
        }
        bg.style.opacity='1'; bg.style.transition='none'; bg.style.letterSpacing=mobileBridge?'0':'-0.015em';
        bg.style.fontStyle='normal'; bg.style.fontWeight='650';
        if(mobileBridge){
          bg.style.setProperty('width','min(620px, calc(100vw - 52px))','important');
          bg.style.setProperty('max-width','min(620px, calc(100vw - 52px))','important');
          bg.style.setProperty('font-size','clamp(26px, 7vw, 31px)','important');
          bg.style.setProperty('line-height','1.16','important');
          bg.style.setProperty('white-space','normal','important');
          bg.style.setProperty('word-break','keep-all','important');
          bg.style.setProperty('overflow-wrap','normal','important');
          bg.style.setProperty('text-wrap','balance','important');
        } else {
          bg.style.width='min(1180px,92vw)'; bg.style.maxWidth='min(1180px,92vw)';
          bg.style.fontSize='clamp(28px,4.4vw,68px)'; bg.style.lineHeight='1.16';
          bg.style.whiteSpace='pre'; bg.style.wordBreak='keep-all'; bg.style.overflowWrap='normal';
          bg.style.textWrap='nowrap';
        }
        bg.style.marginLeft='auto'; bg.style.marginRight='auto'; bg.style.textAlign='center'; bg.style.alignSelf='center';
        this.buildBridgeVisual(bg,type,gi);
        bg._kicker=bg._bridgeStage ? bg._bridgeStage.querySelector('.tt-bridge-label,.tt-gh-bridge-label') : bg.previousElementSibling;
        if(bg._kicker){ bg._kicker.style.transition='none'; bg._kicker.style.opacity='0'; bg._kicker.style.willChange='opacity,transform,letter-spacing'; }
        bg._lines=bg._bridgeStage?bg._bridgeStage.querySelectorAll('[data-bridge-line]'):(bg.parentElement?bg.parentElement.querySelectorAll('[data-bridge-line]'):[]);
        this.fitBridgeCopy(bg);
      }
      if(bg._fitVw !== window.innerWidth) this.fitBridgeCopy(bg);
      // Scroll chooses the bridge; the bridge itself runs once on its own clock.
      if(this._reduceMotion===undefined) this._reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var DUR=this._reduceMotion?700:1200, FINAL=0.90, prog=0, bridgeTime=DUR/1000+gi*0.31;
      var entering=rect.top<=vhR*0.5&&rect.top>=-2&&rect.bottom>vhR*0.5;
      if(!bg._seen&&!this._bridgeRun&&entering){
        if(this._bridgeScrollDir===-1){
          // finished at once; on phones that also shrinks it, so keep the chapter below where it was
          var below=outer.nextElementSibling, belowTop=below?below.getBoundingClientRect().top:0;
          this._bridgeBypassed[gi]=true; bg._seen=true; outer.classList.add('tt-bridge-seen');
          if(below&&this.scroller){ var shift=below.getBoundingClientRect().top-belowTop; if(Math.abs(shift)>0.5){ this.scroller.scrollTop+=shift; this._bridgeScrollPrev=this.scroller.scrollTop; } }
        }
        else this.startBridge(gi);
      }
      var run=this._bridgeRun, active=run&&run.index===gi;
      bg._playing=!!active;
      if(active){
        this._pinBridgeAnchor();
        this._setBridgeProgress(run);
        DUR=run.duration;
        // Start only after the stage/copy have been assembled, not during lazy setup.
        if(run.startedAt==null) run.startedAt=performance.now();
        var elapsed=Math.max(0,performance.now()-run.startedAt), playP=this.cl(elapsed/DUR,0,1);
        prog=playP*FINAL; bridgeTime=Math.min(elapsed,DUR)/1000+gi*0.31;
        if(playP>=1){
          bg._seen=true; bg._ready=true; bg._finalTime=DUR/1000+gi*0.31;
          outer.classList.add('tt-bridge-seen');
          prog=FINAL; bridgeTime=bg._finalTime;
          if(run.phase==='playing'){ run.phase='holding'; this.scroller.dataset.bridgePhase='holding'; }
          if(run.phase==='holding'&&elapsed>=DUR+run.hold) this.advanceBridge(now);
        }
      } else if(bg._seen){
        prog=FINAL; bridgeTime=bg._finalTime==null?DUR/1000+gi*0.31:bg._finalTime;
      }
      var exit=this.smooth(0.965,1.0,prog);

      this.setBridgeVisual(bg,type,prog,exit,bridgeTime);

      var N=bg._words.length;
      for(var k=0;k<N;k++){
        var q=N>1?k/(N-1):0;
        var wp=this.cl((prog-(0.50+q*0.025))/0.10, 0, 1);  // text enters after the motif (~0.50), fully in by ~0.63, then long hold to ADV(0.92)
        var e=1-Math.pow(1-wp,3);
        var hold=1-this.smooth(0.965,1.0,prog);
        var op=e*hold;
        var ty=(1-e)*38 - exit*10;
        var bl=(1-e)*10 + exit*3;
        var w=bg._words[k];
        w.style.opacity=op.toFixed(3);
        w.style.transform='translateY('+ty.toFixed(1)+'px) scale('+(0.985+0.015*e+0.04*(bg._imp||0)*e).toFixed(3)+')';
        w.style.filter = (this._lightMotion || this._reduceMotion) ? 'none' : (bl>0.25 ? 'blur('+bl.toFixed(1)+'px)' : 'none');
      }
      if(bg._kicker){
        // #1 small text appears TOGETHER with the big copy (same reveal window), and only then ??never during the motif
        var kop=this.smooth(0.50,0.64,prog)*(1-this.smooth(0.965,1,prog));
        bg._kicker.style.opacity=(kop*0.78).toFixed(3);
        bg._kicker.style.transform='translateY('+((1-kop)*10).toFixed(1)+'px)';
        bg._kicker.style.letterSpacing=(0.28+0.08*(1-kop)+0.03*(bg._imp||0)).toFixed(2)+'em';
        bg._kicker.style.filter='none';
      }
      if(bg._lines&&bg._lines.length){
        var lineReveal=this.smooth(0.50,0.70,prog)*(1-exit);
        var topG=lineReveal;
        var botG=this.smooth(0.66,0.86,prog)*(1-exit*0.35);
        if(bg._lines[0]){ bg._lines[0].style.transform='scaleY('+topG.toFixed(3)+')'; bg._lines[0].style.opacity=(topG*0.78).toFixed(3); }
        if(bg._lines[1]){ bg._lines[1].style.transform='scaleY('+botG.toFixed(3)+')'; bg._lines[1].style.opacity=(botG*0.78).toFixed(3); }
      }
    }
  },
};
