// Component core: state, lifecycle, the animation loop and the values the template renders.
// Everything else lives in src/app/parts/*.js and is attached to Component.prototype by the build.
class Component extends DCLogic {
  state = { mOpen:false, partnerOpen:false, mi:0, contactCopyMessage:'', inquiryMessage:'' };

  ensureDataReady(){
    if(this._dataReady) return;
    this.initData();
    this._dataReady = true;
  }

  componentDidMount(){
    this.ensureDataReady();
    this._loadSeo();
    this._applySeoForCurrentPage();
    this._mountSiteMessages();
    this._mountScene();
    this._mountBridges();
    this._mountPalettes();
    this._mountViewport();
    this._mountScrollWatch();
    this._mountContactLink();
    this._mountPointerInput();
    this._mountLanguage();
    this._mountChapterNav();
    this._initialRouteTimer1=setTimeout(()=>{ try{ this.applyInitialSectionFromUrl(); }catch(_){} }, 120);
    this._initialRouteTimer2=setTimeout(()=>{ try{ this.applyInitialSectionFromUrl(); }catch(_){} }, 520);
    this.initIntro();
    this._mountVisibility();
    this.raf = requestAnimationFrame(this.loop);
  }
  // Content and language messages from this site itself (see S1 in the code review).
  _mountSiteMessages(){
    // Content and language messages are accepted only from this site's own origin: a page that frames
    // taletone.net must not be able to swap its content (e.g. the contact address) inside the frame.
    this._siteDataListener = (event)=>{
      if(!event || event.origin !== window.location.origin) return;
      var message = event.data || {};
      if(message.type === 'TALETONE_SET_LANG'){
        this.setLang(message.lang || 'kr');
        return;
      }
      if(message.type !== 'TALETONE_SITE_SET_DATA') return;
      window.TALETONE_CONTENT = message.data || {};
      this._applyExternalContent();
      this.forceUpdate();
    };
    window.addEventListener('message', this._siteDataListener);
  }
  // Canvas, sky and the elements the scroll scene animates.
  _mountScene(){
    this.root = document.documentElement;
    this.scroller = document.getElementById('content');
    this.sky = document.getElementById('sky');
    this.glow = document.getElementById('glow');
    this.canvas = document.getElementById('fx');
    this.ctx = this.canvas.getContext('2d');
    this.enforceMobileFxLayer = () => {
      var mobile = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
      if(!mobile || !this.canvas) return;
      this.canvas.style.setProperty('display','block','important');
      this.canvas.style.setProperty('visibility','visible','important');
      this.canvas.style.setProperty('opacity','.82','important');
      this.canvas.style.setProperty('position','fixed','important');
      this.canvas.style.setProperty('inset','0','important');
      this.canvas.style.setProperty('width','100vw','important');
      this.canvas.style.setProperty('height','100lvh','important');
      this.canvas.style.setProperty('min-height','0','important');
      this.canvas.style.setProperty('z-index','2','important');
      this.canvas.style.setProperty('pointer-events','none','important');
      this.canvas.style.setProperty('mix-blend-mode','normal','important');
      this.canvas.style.setProperty('transform','translateZ(0)','important');
      var content = document.getElementById('content');
      if(content){
        content.style.setProperty('background','none','important');
        content.style.setProperty('background-color','transparent','important');
        content.style.setProperty('background-image','none','important');
      }
    };
    this.enforceMobileFxLayer();
    this.sections = ['c-home','c-members','c-projects','c-works','c-contact']
      .map(id=>document.getElementById(id)).filter(Boolean);
    this.pxEls = Array.from(document.querySelectorAll('[data-px]'));
    this.pxEls.forEach(el=>{ el._base = el.style.transform || ''; });
    this.revEls = Array.from(document.querySelectorAll('[data-reveal]'));
    this.revEls.forEach(el=>{ el.style.transition='none'; el.style.willChange='opacity,transform'; });
  }
  // Bridge state, the input lock used while a bridge plays, and its cached geometry.
  _mountBridges(){
    this.bridges = Array.from(document.querySelectorAll('[data-bridge]'));
    this._bridgeSeen = {};
    this._bridgeBypassed = {};
    try{ JSON.parse(sessionStorage.getItem('tt_bridge_seen_v2')||'[]').forEach(i=>{if(Number.isInteger(i)&&i>=-1&&i<5)this._bridgeSeen[i]=true;}); }catch(_){}
    this._bridgeRun = null;
    this._bridgeScrollTop = this.scroller ? this.scroller.scrollTop : 0;
    this._bridgeInputHandler=(e)=>{
      if(e.type==='keydown' && !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' ','Spacebar'].includes(e.key)) return;
      if(e.type==='keydown' && e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
      if(!this._bridgeRun && !(e.timeStamp>0 && e.timeStamp<=(this._bridgeInputCutoff||0))){
        this._bridgeBypassed={}; this._bridgeNavTarget=null; this._sceneDirty=true; return;
      }
      if(this._bridgeRun){
        var nowIn=performance.now(), runIn=this._bridgeRun;
        runIn.lastInputAt=nowIn;
        if(runIn.startedAt!=null&&runIn.phase!=='advancing') runIn.hold=Math.min(runIn.hold,Math.max(0,nowIn-runIn.startedAt-runIn.duration)+450);
      }
      if(e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    };
    ['wheel','touchmove','keydown'].forEach(type=>window.addEventListener(type,this._bridgeInputHandler,{capture:true,passive:false}));
    this._bridgeOffsets = this.bridges.map(bg=>{ var outer=bg.closest?bg.closest('[data-story-bridge-wrap]'):null; return outer?outer.offsetTop:NaN; });
    this._bridgeKR = this.bridges.map(b=>b.textContent.replace(/\s+/g,' ').trim());
    this.bridges.forEach(el=>{ el.style.transition='none'; el.style.willChange='opacity,transform,letter-spacing'; });
    this.collectMotionEls();
    this._layoutGeometryDirty = true;
    this._sceneDirty = true;
    this.lastActive = -1;
    this.t0 = performance.now();
  }
  // The water's colour palettes.
  _mountPalettes(){
    // palettes    // palettes ??the water's mood
    this.P = {
      abyss: {
        stops:[[0,'#eef6f4','#dceef0'],[0.22,'#cfe7ea','#a9d6dc'],[0.42,'#8fc3cf','#5b9fb4'],[0.6,'#3f7d9a','#2a5f80'],[0.76,'#1c4a68','#143a5a'],[0.88,'#0c2a44','#08203a'],[1,'#04101f','#020812']],
        accent:'#0E6E7D', accent2:'#3d8a98', soft:'#364454', ink:'#141C30', paper:'#fffdf8', star:[255,224,168]
      },
      twilight: {
        stops:[[0,'#f6eef6','#efe0ee'],[0.22,'#e6cfe6','#d6a9d2'],[0.42,'#b88fcf','#8a5bb4'],[0.6,'#6f4f9a','#4a2f80'],[0.76,'#3a2868','#2a1c5a'],[0.88,'#1c123a','#140c2e'],[1,'#0c0820','#060312']],
        accent:'#b06ad0', accent2:'#7f6ad6', star:[255,206,230]
      },
      lumen: {
        stops:[[0,'#eef6f1','#dcefe6'],[0.22,'#cfeae0','#a9dcc8'],[0.42,'#7fc7b0','#4ba98e'],[0.6,'#2f8a7a','#1f6a60'],[0.76,'#124a48','#0c3a3c'],[0.88,'#082a2c','#062024'],[1,'#02100f','#010806']],
        accent:'#36c2a0', accent2:'#5fd0c0', star:[180,255,224]
      },
    };
    this.mood = (this.P[this.props.mood] ? this.props.mood : 'abyss');
  }
  // Stars, canvas size and viewport resize handling.
  _mountViewport(){
    this.initStars();
    this.onResize = ()=>{
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf=requestAnimationFrame(()=>this.resize());
    };
    this.resize();
    window.addEventListener('resize', this.onResize, {passive:true});
    this._visualViewport=window.visualViewport||null;
    if(this._visualViewport) this._visualViewport.addEventListener('resize',this.onResize,{passive:true});
  }
  // Scroll watching: bridge entry, menu-jump release and the fast mobile scroll state.
  _mountScrollWatch(){
    this._mobileScrollHandler=()=>{
      this._sceneDirty=true;
      var current=this.scroller?this.scroller.scrollTop:0;
      var previous=this._bridgeScrollTop==null?current:this._bridgeScrollTop;
      this._bridgeScrollTop=current;
      if(this._bridgeRun){ this._pinBridgeAnchor(); return; }
      if(this._bridgeNavTarget){
        var destination=document.getElementById(this._bridgeNavTarget);
        // released on arrival, or once the jump has had time to land (a scrollbar drag sends no input events)
        if(!destination||Math.abs(current-destination.offsetTop)<=3||performance.now()-(this._bridgeNavAt||0)>1500) this._bridgeNavTarget=null;
        return;
      }
      // (not right after the reader went up: bridges play on the way down only, see updateBridges). A bridge
      // also starts when the scroll leaves from just on it: momentum and snapping can park the page a few px
      // short of its top, and the next flick then begins there instead of crossing it. Any step down counts:
      // decelerating momentum moves only a pixel or two per scroll event.
      this._trackBridgeDir(current);
      if(current>previous&&this._bridgeOffsets&&this._bridgeScrollDir!==-1){
        for(var bi=0;bi<this._bridgeOffsets.length;bi++){
          var bridgeTop=this._bridgeOffsets[bi];
          if(!this._bridgeSeen[bi]&&!this._bridgeBypassed[bi]&&isFinite(bridgeTop)&&bridgeTop>previous-6&&bridgeTop<=current+2){
            this.startBridge(bi);
            return;
          }
        }
      }
      if(current>previous+2) this._preloadAhead(current);
      if(!this.isMobileMotion()) return;
      this._fastScrollUntil=performance.now()+220;
      if(this._fastMobileState!==true){ document.body.classList.add('tt-mobile-scroll-active'); this._fastMobileState=true; }
      clearTimeout(this._mobileScrollIdleTimer);
      this._mobileScrollIdleTimer=setTimeout(()=>{
        this._fastScrollUntil=0;
        this._lastLoopFrame=0;
      },190);
    };
    if(this.scroller) this.scroller.addEventListener('scroll',this._mobileScrollHandler,{passive:true});
    // only the reader's own scrolling counts for _preloadAhead (not route landings or menu jumps)
    var markInput=()=>{ this._userScrollAt=performance.now(); };
    ['wheel','touchmove','keydown'].forEach((type)=>window.addEventListener(type,markInput,{passive:true}));
  }
  // Reading downward by hand: a chapter within a screen and a half below the view gets its pictures now
  // (TALETONE_CHAPTER_PRELOAD, as a bridge does), so they are decoded by the time it scrolls in. A menu or
  // dock jump (_chapterTarget, _bridgeNavTarget) or a route landing preloads nothing it passes over.
  _preloadAhead(top){
    if(this._chapterTarget||this._bridgeNavTarget||performance.now()-(this._userScrollAt||-1e9)>1200) return;
    var done=this._preloadedChapters||(this._preloadedChapters={});
    var view=this.scroller?this.scroller.clientHeight:window.innerHeight;
    ['members','projects','works','contact'].forEach((chapter)=>{
      if(done[chapter]) return;
      var section=document.getElementById('c-'+chapter);
      if(!section||section.getBoundingClientRect().top>view*2.5) return;
      done[chapter]=true;
      window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_PRELOAD',{detail:{chapter:chapter}}));
    });
  }
  // The contact button link and label.
  _mountContactLink(){
    var em=document.getElementById('email-link');
    if(em){
      var contact = this.CONTACT || {};
      var link = contact.link || 'mailto:contact@taletone.net';
      em.href = link;
      var emLabel = em.querySelector('[data-email-label]');
      if(emLabel) emLabel.textContent = contact.buttonLabel || 'Tell us your story';
      else em.textContent = contact.buttonLabel || 'Tell us your story';
    }
  }
  // Escape closes dialogs; taps and clicks spawn ink in the water.
  _mountPointerInput(){

    this._escapeHandler=(e)=>{ if(e.key==='Escape') this.closeAll(); };
    window.addEventListener('keydown', this._escapeHandler);
    this._historyHandler=()=>{ if((this.MEMBERS||[]).length) this.openMember(0); };
    window.addEventListener('TALETONE_OPEN_HISTORY', this._historyHandler);
    this._lastInkSpawn = 0;
    this._spawnInkFromEvent = (e)=>{
      var point = e && ((e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e);
      if(!point || typeof point.clientX !== 'number' || typeof point.clientY !== 'number') return;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if(now - this._lastInkSpawn < 70) return;
      this._lastInkSpawn = now;
      this.spawnInk(point.clientX, point.clientY);
    };
    this._inkEvents = [];
    if(window.PointerEvent){
      window.addEventListener('pointerdown', this._spawnInkFromEvent, { passive:true });
      this._inkEvents.push('pointerdown');
    } else {
      window.addEventListener('touchstart', this._spawnInkFromEvent, { passive:true });
      window.addEventListener('click', this._spawnInkFromEvent, { passive:true });
      this._inkEvents.push('touchstart','click');
    }
  }
  // Initial language: ?lang=, then the URL prefix, then the saved choice.
  _mountLanguage(){
    // language: legacy ?lang= wins, then the URL prefix; an unprefixed URL restores the saved choice (KR default)
    try{ var langParam = new URLSearchParams(window.location.search || '').get('lang'), pathLang = this._routeLang(); this.lang = (langParam === 'kr' || langParam === 'en' || langParam === 'jp') ? langParam : (pathLang !== 'kr' ? pathLang : (localStorage.getItem('tt_lang') || 'kr')); }catch(e){ this.lang='kr'; }
    this._syncLangUrl();
    document.documentElement.lang=this.lang==='kr'?'ko':(this.lang==='jp'?'ja':'en');
    this._langInitTimer=setTimeout(()=>{ try{ this.setLang(this.lang); }catch(_){} }, 60);
  }
  // Chapter menu: peek on touch/focus, and client-side chapter navigation.
  _mountChapterNav(){
    this.chapnav = document.getElementById('chapnav');
    this._showNavPeek = ()=>{
      if(!this.chapnav) return;
      this.chapnav.classList.add('tt-nav-peek');
    };
    this._hideNavPeek = (e)=>{
      if(!this.chapnav || !this.chapnav.classList.contains('tt-nav-peek')) return;
      if(this.chapnav.contains(e.target)) return;
      this.chapnav.classList.remove('tt-nav-peek');
    };
    if(this.chapnav){
      this.chapnav.addEventListener('pointerdown', this._showNavPeek);
      this.chapnav.addEventListener('focusin', this._showNavPeek);
      document.addEventListener('pointerdown', this._hideNavPeek, true);
      this._chapterLinkClick = (e)=>{
        var a = e && e.target && e.target.closest ? e.target.closest('#chapnav a[href]') : null;
        if(!a || !document.getElementById('chapnav') || !document.getElementById('chapnav').contains(a)) return;
        if(e.preventDefault) e.preventDefault();
        if(e.stopPropagation) e.stopPropagation();
        var href = this._routePath(a.getAttribute('href') || '/');
        var map = {'/':'c-home','/story-types/':'c-projects','/projects/':'c-projects','/members/':'c-members','/works/':'c-works','/contact/':'c-contact'};
        this.navigateChapter(e, map[href] || 'c-home', href);
      };
      document.addEventListener('click', this._chapterLinkClick, true);
    }
    // "Listen in Works" links (/works/?work=<slug>) stay on the page: Works gets the request inside the click
    // (so its audio may start) and the page travels to the Works chapter.
    this._workLinkClick = (e)=>{
      var a = e && e.target && e.target.closest ? e.target.closest('a[href*="work="]') : null;
      if(!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var url; try{ url = new URL(a.getAttribute('href'), location.href); }catch(_e){ return; }
      var slug = url.searchParams.get('work');
      if(!slug || url.origin !== location.origin || this._routePath(url.pathname) !== '/works/') return;
      var api = window.TALETONE_WORKS_API;
      if(api && api.queue) api.queue(slug);
      this.navigateChapter(e, 'c-works', '/works/');
    };
    document.addEventListener('click', this._workLinkClick, true);
  }
  // Pause the loop while the tab is hidden; resume (and shift a playing bridge clock) when it returns.
  _mountVisibility(){
    this._visibilityHandler=()=>{
      if(document.hidden){
        cancelAnimationFrame(this.raf);
        this.raf=0;
        if(this._bridgeRun) this._bridgeRun.hiddenAt=performance.now();
        return;
      }
      if(!this.raf){
        if(this._bridgeRun && this._bridgeRun.hiddenAt!=null){
          var paused=performance.now()-this._bridgeRun.hiddenAt;
          if(this._bridgeRun.startedAt!=null) this._bridgeRun.startedAt+=paused;
          if(this._bridgeRun.advanceAt!=null) this._bridgeRun.advanceAt+=paused;
          delete this._bridgeRun.hiddenAt;
        }
        this._lastLoopFrame=0;
        this._lastScrollSampleT=null;
        this._layoutGeometryDirty=true;
        this._sceneDirty=true;
        this.raf=requestAnimationFrame(this.loop);
      }
    };
    document.addEventListener('visibilitychange',this._visibilityHandler);
  }
  componentWillUnmount(){                                   
    this.releaseBridge();
    ['wheel','touchmove','keydown'].forEach(type=>window.removeEventListener(type,this._bridgeInputHandler,true));
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    if(this._visualViewport) this._visualViewport.removeEventListener('resize',this.onResize);
    if(this.scroller && this._mobileScrollHandler) this.scroller.removeEventListener('scroll',this._mobileScrollHandler);
    if(this._visibilityHandler) document.removeEventListener('visibilitychange',this._visibilityHandler);
    cancelAnimationFrame(this._resizeRaf);
    clearTimeout(this._mobileScrollIdleTimer);
    clearTimeout(this._introTimer);
    if(this._introSkip){
      window.removeEventListener('wheel',this._introSkip);
      window.removeEventListener('touchmove',this._introSkip);
      window.removeEventListener('pointerdown',this._introSkip);
    }
    window.removeEventListener('message', this._siteDataListener);
    if(this._escapeHandler) window.removeEventListener('keydown',this._escapeHandler);
    if(this._historyHandler) window.removeEventListener('TALETONE_OPEN_HISTORY',this._historyHandler);
    if(this._spawnInkFromEvent){
      var inkEvents = this._inkEvents && this._inkEvents.length ? this._inkEvents : ['pointerdown','touchstart','click'];
      for(var ie=0; ie<inkEvents.length; ie++) window.removeEventListener(inkEvents[ie], this._spawnInkFromEvent);
    }
    if(this.chapnav && this._showNavPeek){
      this.chapnav.removeEventListener('pointerdown', this._showNavPeek);
      this.chapnav.removeEventListener('focusin', this._showNavPeek);
    }
    if(this._chapterLinkClick) document.removeEventListener('click', this._chapterLinkClick, true);
    if(this._hideNavPeek) document.removeEventListener('pointerdown', this._hideNavPeek, true);
    clearTimeout(this._chapterNavCorrect1);
    clearTimeout(this._chapterNavCorrect2);
    clearTimeout(this._routeLandingCorrect1);
    clearTimeout(this._routeLandingCorrect2);
    clearTimeout(this._routeLandingCorrect3);
    clearTimeout(this._contactCopyTimer);
    clearTimeout(this._langInitTimer);
    clearTimeout(this._initialRouteTimer1);
    clearTimeout(this._initialRouteTimer2);
    clearTimeout(this._langRebuildTimer);
  }

  // Load active members.
  componentDidUpdate(){
    this._layoutGeometryDirty = true;
    this._sceneDirty = true;
    this.loadMemberImages();
    window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }
  loop = (frameTime)=>{
    this.raf=0;
    if(document.hidden) return;
    if(this._reduceMotion===undefined) this._reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var frameNow = Number.isFinite(frameTime) ? frameTime : performance.now();
    // at rest (no scroll for 1.2 s, no bridge running) the ambient drift needs no more than 30 fps
    var atRest = this.introDone && !this._bridgeRun && this._lastScrollMoveAt!=null && frameNow-this._lastScrollMoveAt > 1200;
    var minFrameMs = this._reduceMotion ? 64 : (!this.introDone ? (this._introMobile?34:24) : ((atRest || this.isMobileMotion()) ? 34 : 1000/60));
    if(minFrameMs && this._lastLoopFrame && frameNow-this._lastLoopFrame < minFrameMs){
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    if(this._lastLoopFrame){
      this._lastLoopFrame += minFrameMs;
      if(frameNow-this._lastLoopFrame>minFrameMs) this._lastLoopFrame=frameNow;
    } else {
      this._lastLoopFrame = frameNow;
    }
    if(!this.introDone){
      if(this._layoutGeometryDirty&&this.scroller) this.refreshLayoutGeometry(this.scroller.scrollHeight);
      if(!this.introDone){
        this.raf=requestAnimationFrame(this.loop);
        return;
      }
    }
        var scEl = this.scroller || document.getElementById('content');
    if(!scEl){
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this.scroller = scEl;
    var sc = scEl.scrollTop;
    var nowLoop=this.markScrollIntent(sc);
    var fastMobile=this.isFastMobileScroll(nowLoop);
    var layoutHeight=scEl.scrollHeight;
    var max=layoutHeight-scEl.clientHeight;
    var geometryDirty=this._layoutGeometryDirty||this._layoutGeometryHeight!==layoutHeight;
    if(geometryDirty) this.refreshLayoutGeometry(layoutHeight);
    var p = this.cl(max>0?sc/max:0, 0, 1);
    var pal = this.P[this.mood];
    var sceneDirty=this._sceneDirty||geometryDirty||this._lastSceneScroll!==sc||this._lastSceneHeight!==layoutHeight;
    if(fastMobile&&sceneDirty&&Object.keys(this._bridgeSeen).length){
      this.updateBridges(scEl.clientHeight);
    }
    if(fastMobile && this._mobilePaletteFrame && frameNow-this._mobilePaletteFrame<90){
      this.scrollCenter=sc+scEl.clientHeight/2;
      this.scrollP=p;
      var throttledPb=document.getElementById('pbar');
      if(throttledPb) throttledPb.style.width=(8+p*92)+'%';
      this.draw(this._sceneDepth==null?0:this._sceneDepth,pal,true);
      this.raf=requestAnimationFrame(this.loop);
      return;
    }
    if(fastMobile) this._mobilePaletteFrame=frameNow;
    if(sceneDirty){
      this._sceneDirty=false;
      this._lastSceneScroll=sc;
      this._lastSceneHeight=layoutHeight;
      var depthNow = this._depthAt(sc);
      var colorP = depthNow ? depthNow.d : p;
      this._depthMeters = depthNow ? depthNow.m : p*4000;
      this._depthColor = colorP;
      if(!this._pdepth) this._pdepth = document.getElementById('pdepth');
      if(this._pdepth){
        var depthText = Math.round(this._depthMeters).toLocaleString('en-US')+'m · '+Math.round(p*100)+'%';
        if(this._pdepth.textContent!==depthText) this._pdepth.textContent=depthText;
      }
      var ds = (this.props.descent!=null?this.props.descent:0.5);
      this._sceneDepth = this.smooth(0.6 - ds*0.34, 1.0 - ds*0.18, colorP); // descent: how soon/deep the dark sea takes over
      var sk = this.skyColors(pal.stops, colorP);
      var skyBackground = 'linear-gradient(180deg,'+sk[0]+' 0%,'+sk[1]+' 100%)';
      if(this._skyBackground!==skyBackground){ this.sky.style.background=skyBackground; this._skyBackground=skyBackground; }
      if(this.glow && this._glowHidden!==true){ this.glow.style.opacity='0'; this._glowHidden=true; } // all deep light comes from the book only

      var r = this.root.style;
      // text flips dark<->light with a STEEP crossover (no muddy mid-tone) + a depth-aware halo so
      // every chapter stays legible against the sky at any depth
      var tn = this.smooth(0.487, 0.513, colorP);
      this.setCssVar(r,'--ink',this.mix('#141C30','#f4f9ff',tn));
      this.setCssVar(r,'--soft',this.mix('#2c3846','#e2ebf7',tn));
      this.setCssVar(r,'--paper',this.mix('#fffdf8','#0b1330',tn));
      var hs=(1-Math.abs(tn-0.5)*2);                    // 0 at extremes, 1 at the crossover
      var halo = tn<0.5
        ? '0 1px 2px rgba(255,255,255,'+(0.25+0.5*hs).toFixed(2)+'),0 0 18px rgba(255,255,255,'+(0.18+0.4*hs).toFixed(2)+')'
        : '0 1px 2px rgba(3,11,22,'+(0.35+0.45*hs).toFixed(2)+'),0 0 20px rgba(3,11,22,'+(0.25+0.45*hs).toFixed(2)+')';
      this.setCssVar(r,'--halo',halo);
      this.setCssVar(r,'--deep-glow',tn.toFixed(3));
      // continuous depth 0 (surface) .. 1 (sea floor): bridge words glow more the deeper they are
      this.setCssVar(r,'--depth',this.cl((colorP-0.2)/0.72,0,1).toFixed(3));
      // brand mark follows the same ink<->paper flip as the text
      if(!this._brandMark) this._brandMark=document.getElementById('brand-mark');
      if(this._brandMark){ var want = tn<0.5 ? 'assets/logo/mark-ink.png' : 'assets/logo/mark-paper.png'; if(this._brandMarkSrc!==want){ this._brandMark.src=want; this._brandMarkSrc=want; } }
      this.setCssVar(r,'--accent',this.mix(pal.accent,'#ffffff',this._sceneDepth*0.42));
      this.setCssVar(r,'--accent2',this.mix(pal.accent2,'#ffffff',this._sceneDepth*0.42));
      // cards flip with the text colour (light card + dark text, dark card + light text): no grey mid-tone
      this.setCssVar(r,'--card',this.rgba([255,255,255,0.78],[18,32,56,0.72],tn));
      this.setCssVar(r,'--cardBorder',this.rgba([24,32,52,0.1],[200,215,255,0.2],tn));
      this.setCssVar(r,'--line',this.rgba([24,32,52,0.18],[210,225,255,0.28],this._sceneDepth));
    }
    var n=this._sceneDepth==null?0:this._sceneDepth;
    if(fastMobile){
      if(this._fastMobileState!==true){document.body.classList.add('tt-mobile-scroll-active');this._fastMobileState=true;}
      this.scrollCenter=sc+scEl.clientHeight/2;
      this.scrollP=p;
      var fastPb=document.getElementById('pbar');if(fastPb) fastPb.style.width=(8+p*92)+'%';
      this.draw(n,pal,true);
      this._sceneDirty=true;
      this.raf=requestAnimationFrame(this.loop);
      return;
    }
    if(this._fastMobileState!==false){document.body.classList.remove('tt-mobile-scroll-active');this._fastMobileState=false;}
                                                   
    var vh2=window.innerHeight/2, vhR=window.innerHeight, tA=(performance.now()-this.t0)/1000;
    if(sceneDirty){
      // parallax and chapter reveals depend on scroll/layout, not wall-clock time.
      var pxRects = new Array(this.pxEls.length);
      for(var i=0;i<this.pxEls.length;i++){
        pxRects[i]=this.pxEls[i].getBoundingClientRect();
      }
      for(var i=0;i<this.pxEls.length;i++){
        var el=this.pxEls[i], spd=parseFloat(el.getAttribute('data-px'))||0;
        var b=pxRects[i];
        var off=(b.top + b.height/2 - vh2);
        el.style.transform = (el._base?el._base+' ':'')+'translateY('+(off*spd)+'px)';
      }

      var revealRects = new Array(this.revEls.length);
      for(var ri=0;ri<this.revEls.length;ri++) revealRects[ri]=this.revEls[ri].getBoundingClientRect();
      for(var ri=0;ri<this.revEls.length;ri++){
        var re=this.revEls[ri], rb=revealRects[ri];
        var cen=rb.top+rb.height/2, tt=(cen - vhR*0.5)/vhR; // 0 at center, + below, - above
        var enter=this.cl((0.78 - tt)/0.6, 0, 1); enter=1-Math.pow(1-enter,3);   // bottom -> in
        var exit=this.smooth(-0.66,-0.16, tt);                                    // center -> out top
        var op=enter*exit;
        var ty=(1-enter)*64 - (1-exit)*88;
        var sc=0.965 + 0.035*enter - (1-exit)*0.04;
        re.style.opacity=op.toFixed(3);
        re.style.transform='translateY('+ty.toFixed(1)+'px) scale('+sc.toFixed(3)+')';
        if(this._lightMotion===undefined) this._lightMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || window.innerWidth <= 900;
        var memberReveal = re.closest && re.closest('#c-members');
        if(this._lightMotion || memberReveal){
          re.style.filter='none';
        } else {
          var bl=(1-exit)*4; re.style.filter = bl>0.25 ? 'blur('+bl.toFixed(1)+'px)' : 'none';
        }
      }
    }
    // connective bridges: each transition surfaces its line word-by-word, scrubbed to scroll
    var bridgePlaying=false;
    for(var bp=0;bp<this.bridges.length;bp++){
      if(this.bridges[bp]._playing){ bridgePlaying=true; break; }
    }
    if(sceneDirty||bridgePlaying||this._bridgeRun) this.updateBridges(vhR);
    // Time-based decorative transforms need less cadence than the canvas and scroll-derived scene.
    var motionFrameDue=sceneDirty||!this._lastMotionFrame||frameNow-this._lastMotionFrame>=(this.isMobileMotion()?67:34);
    if(motionFrameDue){
      this._lastMotionFrame=frameNow;
      var motionMargin=Math.max(220,vhR*0.72);
      for(var si=0;si<this.spins.length;si++){
        var sp=this.spins[si];
        if(!this.isNearViewport(sp,motionMargin,sp._motionBounds,sc,vhR)){ this.setMotionIdle(sp,true); continue; }
        this.setMotionIdle(sp,false);
        sp.style.transform='rotate('+(tA*(parseFloat(sp.getAttribute('data-spin'))||16)).toFixed(2)+'deg)';
      }
      for(var fi=0;fi<this.floats.length;fi++){
        var fl=this.floats[fi];
        if(!this.isNearViewport(fl,motionMargin,fl._motionBounds,sc,vhR)){ this.setMotionIdle(fl,true); continue; }
        this.setMotionIdle(fl,false);
        var floatY=(Math.sin(tA*0.9+fi)*-12).toFixed(2); fl._floatY=Number(floatY);
        fl.style.transform='translateY('+floatY+'px)';
      }
      // suspended-in-water float: cards drift gently in place, each with its own phase
      if(this.floatCards){ for(var ci=0;ci<this.floatCards.length;ci++){ var fc=this.floatCards[ci];
        if(!this.isNearViewport(fc,motionMargin,fc._motionBounds,sc,vhR)){ this.setMotionIdle(fc,true); continue; }
        this.setMotionIdle(fc,false);
        var yy=Math.sin(tA*0.55+fc._fph)*fc._fpy + Math.sin(tA*0.27+fc._fph*1.3)*1.4;
        var xx=Math.sin(tA*0.4+fc._fph*0.8)*fc._fpx;
        var rr=Math.sin(tA*0.33+fc._fph)*0.5;
        fc.style.transform='translate('+xx.toFixed(2)+'px,'+yy.toFixed(2)+'px) rotate('+rr.toFixed(2)+'deg)';
      }}
      for(var qi=0;qi<this.eqs.length;qi++){
        var eq=this.eqs[qi];
        if(!this.isNearViewport(eq,motionMargin,eq._motionBounds,sc,vhR)){ this.setMotionIdle(eq,true); continue; }
        this.setMotionIdle(eq,false);
        eq.style.transform='scaleY('+(0.28+0.72*(0.5+0.5*Math.sin(tA*5+qi*0.7))).toFixed(3)+')';
      }
      for(var bi=0;bi<this.bobs.length;bi++){
        var bob=this.bobs[bi];
        if(!this.isNearViewport(bob,motionMargin,bob._motionBounds,sc,vhR)){ this.setMotionIdle(bob,true); continue; }
        this.setMotionIdle(bob,false);
        var bs=0.5+0.5*Math.sin(tA*2.4); bob.style.opacity=(0.45+0.55*bs).toFixed(2); bob.style.transform='translateX(-50%) translateY('+(bs*9).toFixed(1)+'px)';
      }
      for(var di=0;di<this.drifts.length;di++){
        var dr=this.drifts[di];
        if(!this.isNearViewport(dr,motionMargin,dr._motionBounds,sc,vhR)){ this.setMotionIdle(dr,true); continue; }
        this.setMotionIdle(dr,false);
        dr.style.transform='translateX('+(Math.sin(tA*0.6)*12).toFixed(1)+'px)';
      }
    }

    if(sceneDirty){
      // active section and progress are scroll-derived; keep their last values while idle.
      if(!this.sections||!this.sections.length){
        this.sections=['c-home','c-members','c-projects','c-works','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
      }
      // A chapter becomes current when its title passes 60% of the screen height (its section box starts much
      // higher, above a tall top padding, so the counter used to lag behind what the reader sees).
      var act=0, line=vh2*1.2;
      if(!this._sectionAnchors) this._sectionAnchors=[];
      for(var k=0;k<this.sections.length;k++){
        var anchor=this._sectionAnchors[k];
        if(!anchor||!anchor.isConnected){ anchor=this.sections[k].querySelector('h2')||this.sections[k]; this._sectionAnchors[k]=anchor===this.sections[k]?null:anchor; }
        if(anchor.getBoundingClientRect().top <= line) act=k;
      }
      if(act!==this.lastActive){
        var navFor={'c-home':0,'c-projects':2,'c-members':3,'c-works':4,'c-contact':6}, actNav=navFor[(this.sections[act]||{}).id];
        for(var j=0;j<7;j++){
          var nb=document.getElementById('nav-'+j); if(!nb) continue;
          var on=j===actNav;
          nb.style.opacity = on?'1':'0.38';
          nb.style.color = on?'var(--accent,#0E6E7D)':'var(--ink,#141C30)';
          var dot=nb.querySelector('.nav-dot') || nb.querySelector('span:last-child');
          if(dot){ dot.style.background = on?'currentColor':'transparent'; }
        }
        var pn=document.getElementById('pnum'); if(pn) pn.textContent = String(act+1).padStart(2,'0');
        var activeSection=this.sections&&this.sections[act];
        var previousSection=this.sections&&this.sections[this.lastActive];
        var activeChapter=activeSection && activeSection.id ? activeSection.id.replace(/^c-/,'') : '';
        var previousChapter=previousSection && previousSection.id ? previousSection.id.replace(/^c-/,'') : '';
        document.body.setAttribute('data-active-chapter', activeChapter);
        // Load photos.
        this.loadMemberImages();
        // Target done.
        if(activeSection&&activeSection.id===this._chapterTarget) this._chapterTarget='';
        try{ window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_CHANGE',{detail:{chapter:activeChapter,previous:previousChapter}})); }catch(_e){}
        this.lastActive=act;
      }
      var pb=document.getElementById('pbar'); if(pb) pb.style.width = (8+p*92)+'%';
      this.scrollCenter = sc + vh2;
      this.scrollP = p;
    }
    this.draw(n, pal, fastMobile);
    this.raf = requestAnimationFrame(this.loop);
  }

  // Story Types: the three kinds of stories, with each service line split into separate chips
  _audiences(){
    var meta = this.PROJECTS_META || {};
    return ['Game', 'Creator', 'Animation'].map((key, i)=>({
      number: String(i + 1).padStart(2, '0'),
      kicker: meta['audience' + key + 'Kicker'] || '',
      title: meta['audience' + key + 'Title'] || '',
      services: [meta['audience' + key + 'Service1'], meta['audience' + key + 'Service2']].join(' · ').split(/\s*[·・]\s*/).filter(Boolean),
      hook: meta['audience' + key + 'Hook'] || ''
    })).filter((item)=>item.title);
  }
  renderVals(){
    this.ensureDataReady();
    return {
      nav0:(e)=>this.navigateChapter(e, 'c-home', '/'),
      nav2:(e)=>this.navigateChapter(e, 'c-projects', '/story-types/'), nav3:(e)=>this.navigateChapter(e, 'c-members', '/members/'),
      nav4:(e)=>this.navigateChapter(e, 'c-works', '/works/'), nav6:(e)=>this.navigateChapter(e, 'c-contact', '/contact/'),
      langKR:()=>this.setLang('kr'), langEN:()=>this.setLang('en'), langJP:()=>this.setLang('jp'),
      HOME: this.HOME || {},
      LATEST_WORK: this.LATEST_WORK || {},
      BRIDGE_0: (this.BRIDGES||[])[0] || {},
      BRIDGE_1: (this.BRIDGES||[])[1] || {},
      BRIDGE_2: (this.BRIDGES||[])[2] || {},
      BRIDGE_3: (this.BRIDGES||[])[3] || {},
      CHAPTER_PROLOGUE: (this.CHAPTER_LABELS||{}).prologue || {},
      CHAPTER_TALE: (this.CHAPTER_LABELS||{}).tale || {},
      CHAPTER_TONE: (this.CHAPTER_LABELS||{}).tone || {},
      CHAPTER_RESURFACE: (this.CHAPTER_LABELS||{}).resurface || {},
      CHAPTER_EPILOGUE: (this.CHAPTER_LABELS||{}).epilogue || {},
      PROJECTS_META: this.PROJECTS_META || {},
      PROJECTS: this.PROJECTS || [],
      AUDIENCES: this._audiences(),
      CONTACT: this.CONTACT || {},
      CONTACT_COPY_MESSAGE: this.state.contactCopyMessage || '',
      INQUIRY_MESSAGE: this.state.inquiryMessage || '',
      copyContactEmail:(e)=>this.copyContactEmail(e),
      sendInquiry:(e)=>this.sendInquiry(e),
      // the featured song, How We Work's steps, client voices and the short inquiry form
      HOME_LISTEN: this.HOME_LISTEN || {}, PROOF: this.PROOF || {}, CASE: this.CASE || {}, VOICES: this.VOICES || {},
      CONTACT_FORM: this.CONTACT_FORM || {}, CONTACT_NO_FORM: !(this.CONTACT_FORM || {}).title, CONTACT_CHANNELS: this.CONTACT_CHANNELS || [],
      TRACK_RECORD: this.TRACK_RECORD || [],
      PARTNERS_META: this.PARTNERS_META || {},
      FOOTER_META: this.FOOTER_META || {},
      UI_LABELS: this.UI_LABELS || {},
      MEMBERS_META: this.MEMBERS_META || {},
      MEMBER_CARDS: (this.MEMBERS||[]).map((m,i)=>Object.assign({}, m, {
        number: String(i + 1).padStart(2, '0'),
        // a member with noDetail (the creative director) has no sheet: the card is not a button
        noDetailFlag: m.noDetail ? 'true' : 'false',
        open: m.noDetail ? ()=>{} : ()=>this.openMember(i)
      })),
      mOpen: this.state.mOpen,
      m: (this.MEMBERS||[])[this.state.mi] || {},
      M_SHEET: this.memberSheet((this.MEMBERS||[])[this.state.mi] || {}),
      partnerOpen: this.state.partnerOpen,
      togglePartner:()=>this.togglePartner(),
      PARTNERS: this.PARTNERS || [],
      partnerClick: (e)=>{ var href=e.currentTarget.getAttribute('href'); if(!href || href==='#'){ if(e && e.preventDefault) e.preventDefault(); } },
      closeModal:()=>this.closeAll(),
      stop:(e)=>{ if(e&&e.stopPropagation) e.stopPropagation(); }
    };
  }
}
