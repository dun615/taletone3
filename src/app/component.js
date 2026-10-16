class Component extends DCLogic {
  state = { mOpen:false, nOpen:false, partnerOpen:false, mi:0, ni:0, contactCopyMessage:'' };

  ensureDataReady(){
    if(this._dataReady) return;
    this.initData();
    this._dataReady = true;
  }

  componentDidMount(){
    this.ensureDataReady();
    this._loadSeo();
    this._applySeoForCurrentPage();
    this._siteDataListener = (event)=>{
      var message = event && event.data ? event.data : {};
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
    this.sections = ['c-home','c-translation','c-projects','c-members','c-works','c-news','c-contact']
      .map(id=>document.getElementById(id)).filter(Boolean);
    this.pxEls = Array.from(document.querySelectorAll('[data-px]'));
    this.pxEls.forEach(el=>{ el._base = el.style.transform || ''; });
    this.revEls = Array.from(document.querySelectorAll('[data-reveal]'));
    this.revEls.forEach(el=>{ el.style.transition='none'; el.style.willChange='opacity,transform'; });
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

    this.initStars();
    this.onResize = ()=>{
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf=requestAnimationFrame(()=>this.resize());
    };
    this.resize();
    window.addEventListener('resize', this.onResize, {passive:true});
    this._visualViewport=window.visualViewport||null;
    if(this._visualViewport) this._visualViewport.addEventListener('resize',this.onResize,{passive:true});
    this._mobileScrollHandler=()=>{
      this._sceneDirty=true;
      var current=this.scroller?this.scroller.scrollTop:0;
      var previous=this._bridgeScrollTop==null?current:this._bridgeScrollTop;
      this._bridgeScrollTop=current;
      if(this._bridgeRun){ this._pinBridgeAnchor(); return; }
      if(this._bridgeNavTarget){
        var destination=document.getElementById(this._bridgeNavTarget);
        if(!destination||Math.abs(current-destination.offsetTop)<=3) this._bridgeNavTarget=null;
        return;
      }
      if(current>previous+2&&this._bridgeOffsets){
        for(var bi=-1;bi<this._bridgeOffsets.length;bi++){
          var bridgeTop=bi===-1?(this.transSec?this.transSec.offsetTop:NaN):this._bridgeOffsets[bi];
          if(!this._bridgeSeen[bi]&&!this._bridgeBypassed[bi]&&isFinite(bridgeTop)&&bridgeTop>previous+2&&bridgeTop<=current+2){
            this.startBridge(bi);
            return;
          }
        }
      }
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

    var em=document.getElementById('email-link');
    if(em){
      var contact = this.CONTACT || {};
      var link = contact.link || ('mailto:' + ['n4ml','taletone.net'].join(String.fromCharCode(64)));
      em.href = link;
      var emLabel = em.querySelector('[data-email-label]');
      if(emLabel) emLabel.textContent = contact.buttonLabel || 'Tell us your story';
      else em.textContent = contact.buttonLabel || 'Tell us your story';
    }

    // --- TRANSLATION centerpiece: build the tale line (letters) + the waveform bars ---
    this.transSec = document.getElementById('c-translation');
    this.newsSec = document.getElementById('c-news');
    this.taleLine = document.getElementById('tale-line');
    this.waveRow  = document.getElementById('wave-row');
    this.transFoot= document.getElementById('trans-foot');
    this.tcaps = [0,1,2].map(i=>document.getElementById('tcap-'+i));
    this.rebuildTranslationLine();
    if(this.waveRow){
      this.NBAR=56; this.bars=[];
      for(var bi=0; bi<this.NBAR; bi++){
        var bar=document.createElement('div');
        var bw='clamp(2px,0.5vw,5px)';
        bar.style.cssText='width:'+bw+';height:6px;border-radius:6px;background:var(--accent,#0E6E7D);opacity:0;transform-origin:center;will-change:height,opacity';
        this.waveRow.appendChild(bar);
        // a stable pseudo-random amplitude profile (bell-ish, music-like)
        var t=bi/(this.NBAR-1), env=Math.sin(t*Math.PI);
        var amp=env*(0.35+0.65*Math.abs(Math.sin(bi*1.7)+0.5*Math.sin(bi*0.6)));
        this.bars.push({el:bar, amp:Math.max(0.12,Math.min(1,amp))});
      }
    }

    this._escapeHandler=(e)=>{ if(e.key==='Escape') this.closeAll(); };
    window.addEventListener('keydown', this._escapeHandler);
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
    // language: legacy ?lang= wins, then the URL prefix; an unprefixed URL restores the saved choice (KR default)
    try{ var langParam = new URLSearchParams(window.location.search || '').get('lang'), pathLang = this._routeLang(); this.lang = (langParam === 'kr' || langParam === 'en' || langParam === 'jp') ? langParam : (pathLang !== 'kr' ? pathLang : (localStorage.getItem('tt_lang') || 'kr')); }catch(e){ this.lang='kr'; }
    this._syncLangUrl();
    document.documentElement.lang=this.lang==='kr'?'ko':(this.lang==='jp'?'ja':'en');
    this._langInitTimer=setTimeout(()=>{ try{ this.setLang(this.lang); }catch(_){} }, 60);
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
        var map = {'/':'c-home','/story-types/':'c-projects','/projects/':'c-projects','/members/':'c-members','/works/':'c-works','/news/':'c-news','/contact/':'c-contact'};
        this.navigateChapter(e, map[href] || 'c-home', href);
      };
      document.addEventListener('click', this._chapterLinkClick, true);
    }
    this._initialRouteTimer1=setTimeout(()=>{ try{ this.applyInitialSectionFromUrl(); }catch(_){} }, 120);
    this._initialRouteTimer2=setTimeout(()=>{ try{ this.applyInitialSectionFromUrl(); }catch(_){} }, 520);
    this.initIntro();
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
    this.raf = requestAnimationFrame(this.loop);
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

  _langKey(){
    var raw = String(this.lang || 'kr').toLowerCase();
    if(raw === 'ko') return 'kr';
    if(raw === 'ja') return 'jp';
    return raw === 'en' || raw === 'jp' ? raw : 'kr';
  }

  _localizedObject(base, translations){
    var result = Object.assign({}, base || {});
    var lang = this._langKey();
    var translated = translations && typeof translations === 'object' ? translations[lang] : null;
    if(translated && typeof translated === 'object'){
      Object.keys(translated).forEach(function(key){
        if(key !== 'cards' && translated[key] != null) result[key] = translated[key];
      });
    }
    return result;
  }

  _localizedListItem(item, sectionTranslations, index){
    var lang = this._langKey();
    var fromSection = null;
    if(sectionTranslations && sectionTranslations[lang] && Array.isArray(sectionTranslations[lang].cards)){
      fromSection = sectionTranslations[lang].cards[index] || null;
    }
    var result = this._localizedObject(item || {}, item && item.translations);
    if(fromSection && typeof fromSection === 'object'){
      Object.keys(fromSection).forEach(function(key){
        if(fromSection[key] != null) result[key] = fromSection[key];
      });
    }
    return result;
  }

  looksLikeRichText(value){
    return typeof value === 'string' && /<\/?(span|strong|b|em|i|u|s|br|sub|sup|p|div)\b|&nbsp;|&#160;/i.test(value);
  }

  cleanRichStyle(styleText){
    var allowed = {
      color: true,
      'background-color': true,
      'font-size': true,
      'font-family': true,
      'font-weight': true,
      'font-style': true,
      'text-decoration': true,
      'letter-spacing': true,
      'line-height': true,
      'text-indent': true,
      'margin-left': true,
      'padding-left': true
    };
    return String(styleText || '').split(';').map(function(part){
      var idx = part.indexOf(':');
      if(idx < 0) return '';
      var name = part.slice(0, idx).trim().toLowerCase();
      var value = part.slice(idx + 1).trim();
      if(!allowed[name]) return '';
      if(/url\s*\(|expression\s*\(|javascript:/i.test(value)) return '';
      return name + ':' + value;
    }).filter(Boolean).join(';');
  }

  sanitizeRichHtml(html){
    var template = document.createElement('template');
    template.innerHTML = String(html == null ? '' : html);
    var allowed = { SPAN:true, STRONG:true, B:true, EM:true, I:true, U:true, S:true, BR:true, SUB:true, SUP:true, P:true, DIV:true };
    var cleanStyle = this.cleanRichStyle.bind(this);
    function clean(parent){
      Array.prototype.slice.call(parent.childNodes).forEach(function(node){
        if(node.nodeType === Node.COMMENT_NODE){ node.remove(); return; }
        if(node.nodeType !== Node.ELEMENT_NODE) return;
        if(!allowed[node.tagName]){
          node.replaceWith(document.createTextNode(node.textContent || ''));
          return;
        }
        Array.prototype.slice.call(node.attributes).forEach(function(attr){
          if(attr.name.toLowerCase() === 'style'){
            var nextStyle = cleanStyle(attr.value);
            if(nextStyle) node.setAttribute('style', nextStyle);
            else node.removeAttribute('style');
          } else {
            node.removeAttribute(attr.name);
          }
        });
        clean(node);
      });
    }
    clean(template.content);
    return template.innerHTML;
  }

  plainTextHtml(value){
    return String(value == null ? '' : value)
      .replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; })
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>');
  }

  normalizedAnimatedText(value){
    return String(value == null ? '' : value)
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim();
  }

  initData(){
    this._applyExternalContent();
  }

  _applyExternalContent(){
    var cfg = window.TALETONE_CONTENT || {};
    var homeData = cfg.home || {};
    this.HOME = this._localizedObject(homeData, homeData.translations);
    var translationData = cfg.translation || {};
    this.TRANSLATION = this._localizedObject(translationData, translationData.translations);
    var projectData = cfg.projects || {};
    this.PROJECTS_META = this._localizedObject(projectData, projectData.translations);
    this.PROJECTS = (Array.isArray(projectData.cards) ? projectData.cards : []).map((p,i)=>this._normalizeVisualEntry(this._localizedListItem(p, projectData.translations, i), 'project-' + (i + 1)));
    var contactData = cfg.contact || {};
    this.CONTACT = this._localizedObject(contactData, contactData.translations);
    var membersMetaData = cfg.membersMeta || {};
    this.MEMBERS_META = this._localizedObject(membersMetaData, membersMetaData.translations);
    var worksMetaData = cfg.worksMeta || {};
    this.WORKS_META = this._localizedObject(worksMetaData, worksMetaData.translations);
    var newsMetaData = cfg.newsMeta || {};
    this.NEWS_META = this._localizedObject(newsMetaData, newsMetaData.translations);
    var partnersMetaData = cfg.partnersMeta || {};
    this.PARTNERS_META = this._localizedObject(partnersMetaData, partnersMetaData.translations);
    this.PARTNERS_META.toggleLabel = this.state && this.state.partnerOpen ? (this.PARTNERS_META.closeLabel || 'Close') : (this.PARTNERS_META.openLabel || 'Open');
    var footerMetaData = cfg.footerMeta || {};
    this.FOOTER_META = this._localizedObject(footerMetaData, footerMetaData.translations);
    var uiLabelData = cfg.uiLabels || {};
    this.UI_LABELS = this._localizedObject(uiLabelData, uiLabelData.translations);
    var chapterLabelData = cfg.chapterLabels || {};
    this.CHAPTER_LABELS = this._localizedObject(chapterLabelData, chapterLabelData.translations);
    this.TRACK_RECORD = (Array.isArray(cfg.trackRecord) ? cfg.trackRecord : []).map((item,i)=>this._localizedObject(Object.assign({ id:'track-' + (i + 1) }, item || {}), item && item.translations));
    if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.setMeta){ try{ window.TALETONE_WORKS_API.setMeta(worksMetaData); }catch(_e){} }
    this.MEMBERS = (Array.isArray(cfg.members) ? cfg.members : []).map((m)=>this._localizedObject(m, m && m.translations));
    this.NEWS = (Array.isArray(cfg.news) ? cfg.news : []).map((n,i)=>this._normalizeVisualEntry(this._localizedObject(n, n && n.translations), 'news-' + (i + 1)));
    // Each news item also has its own static page (generated by scripts/build.mjs).
    var newsPageLabel = { kr:'기사 페이지로 보기', en:'Open article page', jp:'記事ページを見る' }[this.lang || 'kr'];
    this.NEWS.forEach((n, i)=>{ var slug = cfg.news[i] && cfg.news[i].slug; n.pageUrl = slug ? this._langPath('/news/' + slug + '/') : ''; n.pageLabel = newsPageLabel; });
    this.PARTNERS = (Array.isArray(cfg.partners) ? cfg.partners : []).map((p)=>this._localizedObject(p, p && p.translations));
    this._normalizePartners();
    var bridgeData = (Array.isArray(cfg.bridges) ? cfg.bridges : []).filter((bridge)=>{
      var id = String((bridge && bridge.id) || '').toLowerCase();
      return id !== 'home-translation' && id !== 'home_translation' && id !== 'hometranslation';
    });
    this.BRIDGES = bridgeData.map((b)=>this._localizedObject(b, b && b.translations));
  }
  _normalizeNumber(value, fallback){
    var next = Number(String(value == null ? '' : value).replace('%',''));
    return Number.isFinite(next) ? next : fallback;
  }
  _normalizeVisualEntry(item, fallbackSlot){
    var src = Object.assign({}, item || {});
    var posX = this._normalizeNumber(src.posX, 50);
    var posY = this._normalizeNumber(src.posY, 50);
    var brightness = this._normalizeNumber(src.brightness, 100);
    var saturation = this._normalizeNumber(src.saturation, 100);
    var lightness = this._normalizeNumber(src.lightness, 100);
    if (brightness > 0 && brightness <= 2) brightness = brightness * 100;
    if (saturation > 0 && saturation <= 2) saturation = saturation * 100;
    if (lightness > 0 && lightness <= 2) lightness = lightness * 100;
    src.slotId = src.slotId || fallbackSlot;
    src.fit = src.fit || 'cover';
    src.posX = posX;
    src.posY = posY;
    src.position = posX + '% ' + posY + '%';
    src.brightness = brightness;
    src.saturation = saturation;
    src.lightness = lightness;
    src.filter = 'brightness(' + brightness + '%) saturate(' + saturation + '%) contrast(' + lightness + '%)';
    src.buttonColor = src.buttonColor || 'var(--ink,#141C30)';
    src.buttonTextColor = src.buttonTextColor || 'var(--paper,#fffdf8)';
    var rawLink = String(src.link || '').trim();
    src.hasLink = !!rawLink && rawLink !== '#';
    src.isPending = !src.hasLink;
    src.link = src.hasLink ? rawLink : '';
    var external = /^https?:\/\//i.test(src.link);
    if (src.openInNewTab == null) src.openInNewTab = external;
    src.linkTarget = src.openInNewTab ? '_blank' : '_self';
    src.linkRel = src.openInNewTab ? 'noopener noreferrer' : '';
    return src;
  }

  translationMobileLinesFor(kind, fallbackText){
    var data = this.TRANSLATION || {};
    var key = kind === 'footer' ? 'footerMobileLines' : 'mobileLines';
    var source = Array.isArray(data[key]) ? data[key] : null;
    if(!source || !source.length) source = [{ text:String(fallbackText || ''), indent:0 }];
    var out=[];
    for(var i=0; i<source.length; i++){
      var item=source[i] || {};
      var text = item.text == null ? '' : String(item.text);
      if(!text.trim()) continue;
      var indent = parseInt(item.indent, 10);
      if(!isFinite(indent)) indent = 0;
      indent = Math.max(-2, Math.min(2, indent));
      out.push({ text:text, indent:indent });
    }
    return out.length ? out : [{ text:String(fallbackText || ''), indent:0 }];
  }

  rebuildTranslationFooter(){
    if(!this.transFoot) this.transFoot = document.getElementById('trans-foot');
    if(!this.transFoot) return;
    var footer = (this.TRANSLATION && this.TRANSLATION.footer) || '';
    var mobileMode = window.innerWidth <= 760;
    var lines = mobileMode ? this.translationMobileLinesFor('footer', footer) : [];
    var sig = footer + '|' + mobileMode + '|' + (mobileMode ? JSON.stringify(lines) : '');
    if(this._translationFooterSig === sig) return;
    this._translationFooterSig = sig;
    this.transFoot.innerHTML = '';
    if(mobileMode){
      this.transFoot.classList.add('tt-translation-mobile-foot');
      this.transFoot.setAttribute('aria-label', footer.replace(/\s+/g,' ').trim());
      for(var fi=0; fi<lines.length; fi++){
        var line=document.createElement('span');
        line.className='tt-translation-mobile-line';
        line.setAttribute('data-indent', String(lines[fi].indent || 0));
        var inner=document.createElement('span');
        inner.className='tt-translation-mobile-line-inner';
        inner.textContent=lines[fi].text || '';
        line.appendChild(inner);
        this.transFoot.appendChild(line);
      }
      return;
    }
    this.transFoot.classList.remove('tt-translation-mobile-foot');
    this.transFoot.removeAttribute('aria-label');
    this.transFoot.textContent = footer;
  }
  rebuildTranslationLine(){
    if(!this.taleLine) this.taleLine = document.getElementById('tale-line');
    if(!this.taleLine) return;
    var sentence = (this.TRANSLATION && this.TRANSLATION.sentence) || 'Once, a quiet story wished to be heard.';
    var mobileMode = window.innerWidth <= 760;
    var mobileLines = mobileMode ? this.translationMobileLinesFor('sentence', sentence) : [];
    var lineSig = mobileMode ? JSON.stringify(mobileLines) : '';
    if(this._translationSentence === sentence && this._translationMobileMode === mobileMode && this._translationLineSig === lineSig && this.letters && this.letters.length){ this.rebuildTranslationFooter(); return; }
    this._translationSentence = sentence;
    this._translationMobileMode = mobileMode;
    this._translationLineSig = lineSig;
    this.taleLine.innerHTML = '';
    this.taleLine.setAttribute('aria-label', String(sentence).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
    this.letters = [];
    this._translationRich = !mobileMode && (this.looksLikeRichText(sentence) || /[\r\n\t]| {2,}/.test(String(sentence)));
    if(mobileMode){
      this.taleLine.classList.add('tt-translation-mobile-mode');
      this.taleLine.style.whiteSpace = 'normal';
      this.taleLine.style.display = 'flex';
      this.taleLine.style.wordBreak = 'keep-all';
      this.taleLine.style.overflowWrap = 'normal';
      this.taleLine.style.textWrap = 'balance';
      this.taleLine.style.flexDirection = 'column';
      for(var li=0; li<mobileLines.length; li++){
        var line=document.createElement('span');
        line.className='tt-translation-mobile-line';
        line.setAttribute('data-indent', String(mobileLines[li].indent || 0));
        for(var ci=0; ci<String(mobileLines[li].text || '').length; ci++){
          var ch=String(mobileLines[li].text || '')[ci];
          var sp=document.createElement('span');
          sp.className='tt-translation-mobile-line-inner';
          sp.textContent = ch===' ' ? '\u00A0' : ch;
          sp.style.display='inline-block';
          sp.style.willChange='transform,opacity';
          line.appendChild(sp);
          this.letters.push(sp);
        }
        this.taleLine.appendChild(line);
      }
      this.rebuildTranslationFooter();
      return;
    }
    this.taleLine.classList.remove('tt-translation-mobile-mode');
    if(this._translationRich){
      this.taleLine.style.whiteSpace = 'pre-wrap';
      this.taleLine.style.display = 'block';
      this.taleLine.style.wordBreak = 'keep-all';
      this.taleLine.style.overflowWrap = 'anywhere';
      this.taleLine.innerHTML = this.looksLikeRichText(sentence) ? this.sanitizeRichHtml(sentence) : this.plainTextHtml(sentence);
      this.letters = [this.taleLine];
      this.rebuildTranslationFooter();
      return;
    }
    this.taleLine.style.whiteSpace = '';
    this.taleLine.style.display = '';
    this.taleLine.style.wordBreak = '';
    this.taleLine.style.overflowWrap = '';
    this.taleLine.style.textWrap = '';
    this.taleLine.style.flexDirection = '';
    // Letters animate one by one, but lines may only break between words (never "\uB429\uB2C8 / \uB2E4."),
    // and the lines are balanced inside one centred block.
    var block=document.createElement('span');
    block.className='tt-tale-block';
    var word=null;
    for(var ci=0; ci<sentence.length; ci++){
      var ch=sentence[ci];
      if(!word){ word=document.createElement('span'); word.className='tt-tale-word'; block.appendChild(word); }
      var sp=document.createElement('span');
      sp.textContent = ch===' ' ? '\u00A0' : ch;
      sp.style.display='inline-block';
      sp.style.willChange='transform,opacity';
      word.appendChild(sp);
      this.letters.push(sp);
      if(ch===' '){ word=null; block.appendChild(document.createTextNode(' ')); }
    }
    this.taleLine.appendChild(block);
    this.rebuildTranslationFooter();
  }
  loadMemberImages(){
    if(document.body.getAttribute('data-active-chapter')!=='members'||(this._chapterTarget&&this._chapterTarget!=='c-members'))return;
    var section = document.getElementById('c-members');
    if (!section) return;
    section.querySelectorAll('img[data-member-src]').forEach((image)=>{
      var src = image.getAttribute('data-member-src');
      if (src) image.src = src;
      image.removeAttribute('data-member-src');
    });
  }
  // Load active members.
  componentDidUpdate(){
    this._layoutGeometryDirty = true;
    this._sceneDirty = true;
    this.loadMemberImages();
    window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }
  openMember(i){ this.setState({mi:i, mOpen:true}); }
  openNews(i){ this.setState({ni:i, nOpen:true}); }
  togglePartner(){var open=!this.state.partnerOpen;document.body.classList.toggle('tt-network-open',open);this.setState({partnerOpen:open});}
  _normalizePartner(p,i){var src=p||{};return Object.assign({id:'p'+(i+1),name:'Partner Name',role:'Partner',image:'',link:'',brightness:100,saturation:100,lightness:100,textColor:'#ffffff'},src,{id:src.id||('p'+(i+1)),brightness:Number.isFinite(Number(src.brightness))?Number(src.brightness):100,saturation:Number.isFinite(Number(src.saturation))?Number(src.saturation):100,lightness:Number.isFinite(Number(src.lightness))?Number(src.lightness):100,textColor:src.textColor||'#ffffff',link:src.link||''});}
  _normalizePartners(){this.PARTNERS=(this.PARTNERS||[]).map((p,i)=>this._normalizePartner(p,i));}
  closeAll(){document.body.classList.remove('tt-network-open');this.setState({mOpen:false,nOpen:false,partnerOpen:false});}

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
  }
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
  }

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
    // preview page: the redesigned intro, every visit
    if(document.documentElement.hasAttribute('data-intro-v2')&&isHomeRoute&&!reduce&&this.introEl){ this._introV2=true; this.initIntroV2(); return; }
    if(!this.introEl || !isHomeRoute || (seen&&!forceIntro) || reduce){
      if(this.introEl) this.introEl.style.display='none';
      document.body.classList.remove('tt-intro-running');
      this.introDone=true;
      return;
    }

    this.iScene=document.getElementById('intro-scene');
    this.iSky=document.getElementById('intro-skyw');
    this.iWaves=document.getElementById('intro-waves');
    this.iSea=document.getElementById('intro-sea');
    this.iSeaBg=document.getElementById('intro-seabg');
    this.iFlash=document.getElementById('intro-flash');
    this.iUnder=document.getElementById('intro-under');
    this.iOverlight=document.getElementById('intro-overlight');
    this.iShade=document.getElementById('intro-depthshade');
    this.iFoamL=document.getElementById('intro-foamline');
    this.iSkip=document.getElementById('intro-skip');

    this.introEl.style.opacity='1';
    this.introEl.style.transform='none';
    this.introEl.style.backgroundColor='transparent';
    this.introEl.style.pointerEvents='auto';
    this._introLayerZ=this.introEl.style.zIndex;
    this.introEl.style.zIndex='4';
    if(this.iSea){
      this.iSea.style.clipPath='polygon(0 3%,8% 1.3%,16% 2.6%,24% .8%,32% 2.2%,40% 1%,48% 2.8%,56% 1.2%,64% 2.4%,72% .9%,80% 2.6%,88% 1.1%,96% 2.2%,100% 1.4%,100% 100%,0 100%)';
      this.iSea.style.transform='translate3d(0,104%,0)';
    }

    // Lift the real HOME above the underwater plate. Nothing is cloned.
    this.iContent=document.getElementById('content');
    if(this.iContent){
      this._introContentState={
        zIndex:this.iContent.style.zIndex,
        pointerEvents:this.iContent.style.pointerEvents
      };
      this.iContent.scrollTop=0;
      this.iContent.style.zIndex='5';
      this.iContent.style.pointerEvents='none';
    }

    // Each real HOME piece is constructed by a geometric mask, not opacity crossfade.
    this._introHomeAssembly=[];
    var homeTargets=Array.from(document.querySelectorAll('#c-home > [data-px],#c-home > [data-reveal],#c-home > [data-bob]'));
    var homeParagraphIndex=0;
    for(var hi=0;hi<homeTargets.length;hi++){
      var homeEl=homeTargets[hi];
      var isReveal=homeEl.hasAttribute('data-reveal');
      var parsedOpacity=parseFloat(homeEl.style.opacity);
      var finalOpacity=isReveal?1:(Number.isFinite(parsedOpacity)?parsedOpacity:1);
      var kind='eyebrow';
      if(homeEl.hasAttribute('data-bob')) kind='hint';
      else if(homeEl.querySelector('svg')) kind='wave';
      else if(homeEl.hasAttribute('data-px')) kind='ghost';
      else if(homeEl.tagName==='H1') kind='title';
      else if(homeEl.classList.contains('tt-home-quick-actions')) kind='actions';
      else if(homeEl.tagName==='P') kind=homeParagraphIndex++===0?'subtitle':'description';
      var targetTransform=isReveal?'translateY(0px) scale(1)':homeEl.style.transform;
      var beforeMeasureTransform=homeEl.style.transform;
      homeEl.style.transform=targetTransform;
      var targetRect=homeEl.getBoundingClientRect();
      homeEl.style.transform=beforeMeasureTransform;
      var homeItem={
        el:homeEl,
        kind:kind,
        finalOpacity:finalOpacity,
        opacity:homeEl.style.opacity,
        transform:homeEl.style.transform,
        targetTransform:targetTransform,
        transition:homeEl.style.transition,
        filter:homeEl.style.filter,
        willChange:homeEl.style.willChange,
        clipPath:homeEl.style.clipPath,
        webkitClipPath:homeEl.style.webkitClipPath,
        transformOrigin:homeEl.style.transformOrigin,
        letterSpacing:homeEl.style.letterSpacing,
        targetX:targetRect.left+targetRect.width/2,
        targetY:targetRect.top+targetRect.height/2,
        wavePaths:[],
        waveDots:[]
      };
      this._introHomeAssembly.push(homeItem);
      homeEl.style.transition='none';
      homeEl.style.willChange='transform,clip-path';
      homeEl.style.opacity=String(finalOpacity);
      homeEl.style.filter='none';
      homeEl.style.transformOrigin='50% 50%';
      var initialClip=(kind==='ghost')?'circle(0% at 50% 50%)':
        (kind==='title'||kind==='eyebrow'||kind==='actions'||kind==='wave')?'inset(0 50% 0 50%)':
        (kind==='hint')?'inset(0 0 100% 0)':'inset(100% 0 0 0)';
      homeEl.style.clipPath=initialClip;
      homeEl.style.webkitClipPath=initialClip;
      var initialTransform=targetTransform||'';
      if(kind==='ghost') initialTransform+=' scale(.72)';
      else if(kind==='title') initialTransform+=' translate3d(0,12px,0) scaleX(.72) scaleY(.92)';
      else if(kind==='eyebrow') initialTransform+=' translate3d(0,8px,0) scaleX(.78)';
      else if(kind==='subtitle'||kind==='description') initialTransform+=' translate3d(0,18px,0)';
      else if(kind==='actions') initialTransform+=' scaleX(.76)';
      else if(kind==='wave') initialTransform+=' translate3d(0,16px,0)';
      else initialTransform+=' translate3d(0,14px,0)';
      homeEl.style.transform=initialTransform.trim();
      if(kind==='wave'){
        var wavePaths=Array.from(homeEl.querySelectorAll('path'));
        for(var wpi=0;wpi<wavePaths.length;wpi++){
          var wavePath=wavePaths[wpi], waveLength=0;
          try{ waveLength=wavePath.getTotalLength(); }catch(e){}
          var wavePathState={
            el:wavePath,
            length:waveLength,
            dasharray:wavePath.style.strokeDasharray,
            dashoffset:wavePath.style.strokeDashoffset,
            willChange:wavePath.style.willChange
          };
          homeItem.wavePaths.push(wavePathState);
          if(waveLength>0){
            wavePath.style.strokeDasharray=waveLength.toFixed(2);
            wavePath.style.strokeDashoffset=waveLength.toFixed(2);
            wavePath.style.willChange='stroke-dashoffset';
          }
        }
        var waveDots=Array.from(homeEl.querySelectorAll('circle'));
        for(var wdi=0;wdi<waveDots.length;wdi++){
          var waveDot=waveDots[wdi];
          homeItem.waveDots.push({
            el:waveDot,
            transform:waveDot.style.transform,
            transformOrigin:waveDot.style.transformOrigin,
            transformBox:waveDot.style.transformBox
          });
          waveDot.style.transformBox='fill-box';
          waveDot.style.transformOrigin='center';
          waveDot.style.transform='scale(0)';
        }
      }
      if(kind==='hint'){
        var hintLine=homeEl.querySelector('div');
        if(hintLine){
          homeItem.hintLine={el:hintLine,transform:hintLine.style.transform,transformOrigin:hintLine.style.transformOrigin};
          hintLine.style.transformOrigin='50% 100%';
          hintLine.style.transform='scaleY(0)';
        }
      }
    }

    this._introChromeTargets=[];
    var chromeIds=['brand','lang-switcher','chapnav','progress'];
    for(var ci=0;ci<chromeIds.length;ci++){
      var chromeEl=document.getElementById(chromeIds[ci]);
      if(!chromeEl) continue;
      var chromeItem={
        el:chromeEl,
        index:ci,
        opacity:chromeEl.style.opacity,
        transform:chromeEl.style.transform,
        willChange:chromeEl.style.willChange,
        clipPath:chromeEl.style.clipPath,
        webkitClipPath:chromeEl.style.webkitClipPath,
        zIndex:chromeEl.style.zIndex,
        pointerEvents:chromeEl.style.pointerEvents,
        transition:chromeEl.style.transition
      };
      this._introChromeTargets.push(chromeItem);
      chromeEl.style.opacity='1';
      chromeEl.style.zIndex='6';
      chromeEl.style.pointerEvents='none';
      chromeEl.style.transition='none';
      chromeEl.style.willChange='transform,clip-path';
      var fromLeft=ci===0||ci===3;
      var chromeClip=fromLeft?'inset(0 100% 0 0)':'inset(0 0 0 100%)';
      chromeEl.style.clipPath=chromeClip;
      chromeEl.style.webkitClipPath=chromeClip;
      chromeEl.style.transform=(chromeItem.transform?chromeItem.transform+' ':'')+'translate3d('+(fromLeft?-42:42)+'px,0,0)';
    }

    var introPalette=this.P&&this.P[this.mood];
    if(introPalette&&this.root){
      var introRootStyle=this.root.style;
      this.setCssVar(introRootStyle,'--ink','#141C30');
      this.setCssVar(introRootStyle,'--soft','#44505F');
      this.setCssVar(introRootStyle,'--paper','#fffdf8');
      this.setCssVar(introRootStyle,'--accent',introPalette.accent);
      this.setCssVar(introRootStyle,'--accent2',introPalette.accent2);
      this.setCssVar(introRootStyle,'--card','rgba(255,255,255,.78)');
      this.setCssVar(introRootStyle,'--cardBorder','rgba(24,32,52,.1)');
      this.setCssVar(introRootStyle,'--line','rgba(24,32,52,.18)');
      this.setCssVar(introRootStyle,'--halo','0 1px 2px rgba(255,255,255,.25),0 0 18px rgba(255,255,255,.18)');
      if(this.sky){
        // Keep the raw HOME hex stops: mix() interpolates hex values during the handoff.
        var introSky=[introPalette.stops[0][1],introPalette.stops[0][2]];
        this._introHomeSky=introSky;
        this._introHomeBackground='linear-gradient(180deg,'+introSky[0]+' 0%,'+introSky[1]+' 100%)';
        this._introWaterTop='#c9ecee';
        this._introWaterBottom='#5b9fb0';
        this._skyBackground='linear-gradient(180deg,'+this._introWaterTop+' 0%,'+this._introWaterBottom+' 100%)';
        this.sky.style.background=this._skyBackground;
      }
    }
    document.body.classList.add('tt-intro-running');
    this._finishIntro=()=>{
      if(this.introDone) return;
      clearTimeout(this._introTimer);
      if(this._introSkip){
        window.removeEventListener('wheel',this._introSkip);
        window.removeEventListener('touchmove',this._introSkip);
        window.removeEventListener('pointerdown',this._introSkip);
      }
      for(var fi=0;fi<this._introHomeAssembly.length;fi++){
        var item=this._introHomeAssembly[fi], el=item.el;
        el.style.opacity=String(item.finalOpacity);
        el.style.transform=item.targetTransform;
        el.style.transition=item.transition;
        el.style.filter=item.filter||'none';
        el.style.willChange=item.willChange;
        el.style.clipPath=item.clipPath;
        el.style.webkitClipPath=item.webkitClipPath;
        el.style.transformOrigin=item.transformOrigin;
        el.style.letterSpacing=item.letterSpacing;
        for(var fpi=0;fpi<item.wavePaths.length;fpi++){
          var finalPath=item.wavePaths[fpi];
          finalPath.el.style.strokeDasharray=finalPath.dasharray;
          finalPath.el.style.strokeDashoffset=finalPath.dashoffset;
          finalPath.el.style.willChange=finalPath.willChange;
        }
        for(var fdi=0;fdi<item.waveDots.length;fdi++){
          var finalDot=item.waveDots[fdi];
          finalDot.el.style.transform=finalDot.transform;
          finalDot.el.style.transformOrigin=finalDot.transformOrigin;
          finalDot.el.style.transformBox=finalDot.transformBox;
        }
        if(item.hintLine){
          item.hintLine.el.style.transform=item.hintLine.transform;
          item.hintLine.el.style.transformOrigin=item.hintLine.transformOrigin;
        }
      }
      if(this.iContent&&this._introContentState){
        this.iContent.style.zIndex=this._introContentState.zIndex;
        this.iContent.style.pointerEvents=this._introContentState.pointerEvents;
      }
      for(var ci=0;ci<this._introChromeTargets.length;ci++){
        var chrome=this._introChromeTargets[ci], chromeEl=chrome.el;
        chromeEl.style.opacity=chrome.opacity;
        chromeEl.style.transform=chrome.transform;
        chromeEl.style.willChange=chrome.willChange;
        chromeEl.style.clipPath=chrome.clipPath;
        chromeEl.style.webkitClipPath=chrome.webkitClipPath;
        chromeEl.style.zIndex=chrome.zIndex;
        chromeEl.style.pointerEvents=chrome.pointerEvents;
        chromeEl.style.transition=chrome.transition;
      }
      document.body.classList.remove('tt-intro-running');
      this.introEl.style.display='none';
      this.introEl.style.backgroundColor='';
      this.introEl.style.pointerEvents='';
      this.introEl.style.zIndex=this._introLayerZ;
      if(this.iScene){
        this.iScene.style.opacity='';
        this.iScene.style.transform='';
        this.iScene.style.clipPath='';
        this.iScene.style.webkitClipPath='';
      }
      if(this.sky&&this._introHomeSky){
        this._skyBackground=this._introHomeBackground||('linear-gradient(180deg,'+this._introHomeSky[0]+' 0%,'+this._introHomeSky[1]+' 100%)');
        this.sky.style.background=this._skyBackground;
        if(this.iSeaBg) this.iSeaBg.style.background=this._skyBackground;
      }
      this._layoutGeometryDirty=true;
      this._sceneDirty=true;
      this.introDone=true;
      try{ sessionStorage.setItem('tt_intro_home_v5','1'); }catch(e){}
    };

    var clw=document.getElementById('intro-clouds');
    this.iCloudWrap=clw;
    if(clw){
      clw.textContent='';
      var cloudCount=this._introMobile?2:4;
      for(var cw=0;cw<cloudCount;cw++){
        var cd=document.createElement('div'), far=0.4+Math.random()*0.6;
        cd.style.cssText='position:absolute;left:'+(-8+Math.random()*88).toFixed(1)+'%;top:'+(4+Math.random()*58).toFixed(1)+'%;width:'+((14+Math.random()*26)*far+12).toFixed(0)+'vw;height:'+((3.5+Math.random()*4)*far+2).toFixed(1)+'%;border-radius:50%;background:rgba(255,255,255,'+(0.46+far*0.28).toFixed(2)+');filter:blur('+(this._introMobile?8:12+far*6).toFixed(0)+'px)';
        clw.appendChild(cd);
      }
    }

    if(this.iWaves){
      this.iWaves.textContent='';
      var stripeCount=this._introMobile?5:8;
      for(var ws=0;ws<stripeCount;ws++){
        var sl=document.createElement('div');
        sl.style.cssText='position:absolute;left:-6%;width:112%;top:'+(Math.pow(ws/(stripeCount-1),1.55)*96).toFixed(1)+'%;height:'+(1+ws*0.55).toFixed(1)+'px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,'+(0.16+ws*0.018).toFixed(2)+') 18%,rgba(255,255,255,'+(0.2+ws*0.022).toFixed(2)+') 50%,rgba(255,255,255,'+(0.16+ws*0.018).toFixed(2)+') 82%,rgba(255,255,255,0));border-radius:99px';
        this.iWaves.appendChild(sl);
      }
      var glintCount=this._introMobile?6:14;
      for(var g=0;g<glintCount;g++){
        var gl=document.createElement('div'), gr=Math.random();
        gl.style.cssText='position:absolute;left:'+(2+Math.random()*96).toFixed(1)+'%;top:'+(Math.pow(Math.random(),1.6)*62+2).toFixed(1)+'%;width:'+(2+gr*4).toFixed(1)+'px;height:'+(1+gr*1.5).toFixed(1)+'px;border-radius:50%;background:rgba(255,255,255,.94);box-shadow:0 0 6px rgba(255,255,255,.72);opacity:'+(0.18+Math.random()*0.48).toFixed(2);
        this.iWaves.appendChild(gl);
      }
    }

    var stw=document.getElementById('intro-streaks');
    this.iStreaks=[];
    if(stw){
      stw.textContent='';
      var streakCount=this._introMobile?4:7;
      for(var s=0;s<streakCount;s++){
        var st=document.createElement('div');
        st.style.cssText='position:absolute;left:'+(5+Math.random()*90).toFixed(1)+'%;top:0;width:'+(1+Math.random()*2).toFixed(1)+'px;height:'+(14+Math.random()*22).toFixed(0)+'vh;border-radius:3px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.75),rgba(255,255,255,0));opacity:0;will-change:transform,opacity';
        st._st=Math.random(); st._sp2=0.6+Math.random()*0.8;
        stw.appendChild(st); this.iStreaks.push(st);
      }
    }

    var bwrap=document.getElementById('intro-bubbles');
    this.iBubs=[];
    if(bwrap){
      bwrap.textContent='';
      var bubbleCount=this._introMobile?10:18;
      for(var b=0;b<bubbleCount;b++){
        var bu=document.createElement('div'), bs=5+Math.random()*(this._introMobile?12:18);
        bu.style.cssText='position:absolute;left:'+(4+Math.random()*92).toFixed(1)+'%;top:0;width:'+bs.toFixed(0)+'px;height:'+bs.toFixed(0)+'px;border-radius:50%;border:1.5px solid rgba(255,255,255,.82);background:radial-gradient(circle at 34% 30%,rgba(255,255,255,.52),rgba(255,255,255,.04) 62%);opacity:0;will-change:transform,opacity';
        bu._st=Math.random(); bu._wob=Math.random()*6.28; bu._spd=0.7+Math.random()*0.6;
        bwrap.appendChild(bu); this.iBubs.push(bu);
      }
    }

    var dwrap=document.getElementById('intro-drops');
    this.iDrops=[];
    if(dwrap){
      dwrap.textContent='';
      var dropCount=this._introMobile?6:10;
      for(var dp=0;dp<dropCount;dp++){
        var dr=document.createElement('div'), ds2=3+Math.random()*7;
        dr.style.cssText='position:absolute;left:'+(4+Math.random()*92).toFixed(1)+'%;top:0;width:'+ds2.toFixed(0)+'px;height:'+ds2.toFixed(0)+'px;border-radius:50%;background:rgba(255,255,255,.96);box-shadow:0 0 8px rgba(255,255,255,.72);opacity:0;will-change:transform,opacity';
        dr._dx=Math.random()*2-1; dr._vy=0.7+Math.random()*0.5; dr._st=Math.random();
        dwrap.appendChild(dr); this.iDrops.push(dr);
      }
    }

    // Give every descending particle a real HOME coordinate to settle into.
    var assemblyTargets=this._introHomeAssembly.filter(function(item){ return item.kind!=='ghost'; });
    var vw=window.innerWidth||1, vh=window.innerHeight||1;
    if(assemblyTargets.length){
      for(var bt=0;bt<this.iBubs.length;bt++){
        var bubbleTarget=assemblyTargets[bt%assemblyTargets.length], targetBubble=this.iBubs[bt];
        targetBubble._targetX=bubbleTarget.targetX+vw*0.08-targetBubble.offsetLeft;
        targetBubble._targetY=bubbleTarget.targetY+vh*0.1384;
      }
      for(var stt=0;stt<this.iStreaks.length;stt++){
        var streakTarget=assemblyTargets[(stt+1)%assemblyTargets.length], targetStreak=this.iStreaks[stt];
        targetStreak._targetX=streakTarget.targetX+vw*0.08-targetStreak.offsetLeft;
        targetStreak._targetY=streakTarget.targetY+vh*0.07;
      }
    }

    this.introStart=performance.now();
    this.introDone=false;
    document.body.classList.add('tt-intro-running');
    this.introEl.style.display='block';
    this._introSkip=()=>this.skipIntro();
    window.addEventListener('wheel',this._introSkip,{passive:true});
    window.addEventListener('touchmove',this._introSkip,{passive:true});
    window.addEventListener('pointerdown',this._introSkip,{passive:true});
    this._introTimer=setTimeout(this._finishIntro,this.INTRO_MS+240);
  }

  // ===== Intro v2 (preview): a drop of story falls, the camera breaks the surface,
  // and the light gathers into the real wordmark, turning into ink as it lands. =====
  initIntroV2(){
    var self=this;
    if(this.introEl) this.introEl.style.display='none';
    var cv=document.createElement('canvas');
    cv.id='intro-v2'; cv.setAttribute('aria-hidden','true');
    cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100lvh;z-index:1000;pointer-events:auto;cursor:pointer';
    document.body.appendChild(cv);
    var W=window.innerWidth, H=window.innerHeight, mobile=W<=760;
    var dpr=Math.min(window.devicePixelRatio||1, mobile?1.5:2);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
    var c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
    var T={drop:950, impact:1350, plunge:2350, gather:3750, handoff:3900, end:mobile?4400:4750};
    var horizon=H*0.6, cx=W*0.5;
    var homeSky=this.skyColors(this.P[this.mood].stops,0.2);
    var N=mobile?520:1100, P=[];
    for(var i=0;i<N;i++){
      var a=-Math.PI*(0.1+Math.random()*0.8), sp=(Math.random()*0.9+0.25)*(mobile?7:10);
      P.push({x:cx,y:horizon,vx:(Math.random()*2-1)*(mobile?9:14),vy:-(Math.random()*(mobile?10:15)+3),tx:cx,ty:H*0.45,sx:0,sy:0,s:Math.random()*1.4+0.8,d:Math.random()*0.45,tw:Math.random()*6.28,a0:Math.random()*6.283,r0:Math.pow(Math.random(),0.7),dir:Math.random()<0.8?1:-1});
    }
    var bub=[]; for(var b=0;b<(mobile?26:56);b++) bub.push({x:Math.random()*W,y:H+Math.random()*H*1.4,r:Math.random()*4+1.2,sp:Math.random()*1.1+0.7,ph:Math.random()*6.28});
    var glow=document.createElement('canvas'); glow.width=glow.height=128;
    (function(){ var g=glow.getContext('2d'), gr=g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.3,'rgba(255,255,255,.5)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); })();
    var targeted=false, released=false, finished=false, skipShift=0;
    var ease=function(x){ x=Math.max(0,Math.min(1,x)); return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2; };
    var lerp=function(a,b,t){ return a+(b-a)*t; };
    var mixRGB=function(a,b,t){ return 'rgb('+Math.round(lerp(a[0],b[0],t))+','+Math.round(lerp(a[1],b[1],t))+','+Math.round(lerp(a[2],b[2],t))+')'; };
    var hexRGB=function(h){ var m=String(h).match(/\d+/g); if(m&&m.length>=3) return m.slice(0,3).map(Number); h=String(h).replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
    var homeTop=hexRGB(homeSky[0]), homeBot=hexRGB(homeSky[1]);
    function sampleTargets(){
      var h1=document.querySelector('#c-home h1'), pts=[];
      if(h1){
        var r=h1.getBoundingClientRect(), cs=getComputedStyle(h1);
        var lines=String(h1.innerText||'TALETONE\nMUSIC').split(/\n+/).map(function(s){return s.trim();}).filter(Boolean);
        var ow=Math.max(1,Math.round(r.width)), oh=Math.max(1,Math.round(r.height));
        var oc=document.createElement('canvas'); oc.width=ow; oc.height=oh;
        var g=oc.getContext('2d'); g.fillStyle='#000'; g.textAlign='center'; g.textBaseline='middle';
        g.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
        var lh=oh/lines.length, shift=parseFloat((cs.transform.match(/matrix\([^)]*,\s*([-\d.]+)\)$/)||[])[1])||0;
        lines.forEach(function(l,li){ g.fillText(l,ow/2,lh*(li+0.5)); });
        var data=g.getImageData(0,0,ow,oh).data, step=Math.max(3,Math.round(Math.sqrt(ow*oh/(N*2.2))));
        for(var y=0;y<oh;y+=step) for(var x=0;x<ow;x+=step) if(data[(y*ow+x)*4+3]>140) pts.push([r.left+x,r.top+y-shift]);
      }
      if(!pts.length) pts=[[cx,H*0.45]];
      for(var k=pts.length-1;k>0;k--){ var j=(Math.random()*(k+1))|0, tmp=pts[k]; pts[k]=pts[j]; pts[j]=tmp; }
      for(var q=0;q<P.length;q++){ var pt=pts[q%pts.length]; P[q].tx=pt[0]+(Math.random()-0.5)*1.5; P[q].ty=pt[1]+(Math.random()-0.5)*1.5; }
    }
    function waterline(y,t,amp){
      c.beginPath();
      for(var x=0;x<=W+16;x+=16){ var yy=y+Math.sin(x*0.016+t*2.2)*amp+Math.sin(x*0.043-t*1.6)*amp*0.45; if(x===0)c.moveTo(x,yy); else c.lineTo(x,yy); }
    }
    function frame(now){
      if(finished) return;
      var t=now-self._introV2Start+skipShift, ts=t/1000;
      // camera: before the plunge we look at the horizon; the plunge carries us below the surface
      var plunge=ease((t-T.impact)/(T.plunge-T.impact));
      var hy=horizon-plunge*(horizon+H*0.35);           // where the surface sits on screen
      var under=Math.max(0,Math.min(1,(t-T.impact)/(T.plunge-T.impact)*1.3));
      var settle=ease((t-T.plunge)/(T.gather-T.plunge));
      c.setTransform(dpr,0,0,dpr,0,0);
      // --- water body (below the surface line), shifting toward the Home sea as we settle
      var wTop=[lerp(201,homeTop[0],settle),lerp(236,homeTop[1],settle),lerp(238,homeTop[2],settle)];
      var wBot=[lerp(70,homeBot[0],settle),lerp(140,homeBot[1],settle),lerp(165,homeBot[2],settle)];
      var wg=c.createLinearGradient(0,Math.min(hy,0),0,H);
      wg.addColorStop(0,mixRGB(wTop,wTop,0)); wg.addColorStop(1,mixRGB(wBot,wBot,0));
      c.fillStyle=wg; c.fillRect(0,0,W,H);
      // --- sky above the surface (only while it is still on screen)
      if(hy>-40){
        var sg=c.createLinearGradient(0,hy-H*0.75,0,hy);
        sg.addColorStop(0,'#7fb9d2'); sg.addColorStop(0.62,'#cfe9ee'); sg.addColorStop(1,'#f4fbf8');
        c.fillStyle=sg; c.fillRect(0,0,W,Math.max(0,hy));
        var sun=c.createRadialGradient(cx,hy,0,cx,hy,W*0.45);
        sun.addColorStop(0,'rgba(255,246,220,.95)'); sun.addColorStop(0.3,'rgba(255,240,205,.35)'); sun.addColorStop(1,'rgba(255,240,205,0)');
        c.fillStyle=sun; c.fillRect(0,hy-W*0.45,W,W*0.9);
        // sea seen from above: perspective glints that run toward the horizon
        if(plunge<0.6){
          c.strokeStyle='rgba(255,255,255,'+(0.55*(1-plunge/0.6)).toFixed(3)+')'; c.lineWidth=1.2;
          for(var gl=0;gl<14;gl++){
            var gy=hy+Math.pow(gl/14,1.8)*(H-hy)+4, gw=W*(0.08+gl*0.04);
            var gx=cx+Math.sin(ts*0.8+gl*1.9)*W*0.12;
            c.globalAlpha=0.6*(1-gl/16); c.beginPath(); c.moveTo(gx-gw/2,gy); c.lineTo(gx+gw/2,gy); c.stroke();
          }
          c.globalAlpha=1;
        }
      }
      // --- the surface line itself: from above a calm horizon, from below a bright, rippling ceiling
      if(hy>-60&&hy<H+40){
        var below=plunge>0.35;
        c.lineWidth=below?3:1.6;
        c.strokeStyle=below?'rgba(255,255,255,.95)':'rgba(255,255,255,.85)';
        waterline(hy,ts,below?9:1.5); c.stroke();
        if(below){
          var ceil=c.createLinearGradient(0,hy,0,hy+H*0.35);
          ceil.addColorStop(0,'rgba(255,255,255,.55)'); ceil.addColorStop(1,'rgba(255,255,255,0)');
          c.fillStyle=ceil; c.fillRect(0,hy,W,H*0.35);
        }
      }
      // --- god rays once we are under
      if(under>0.05){
        c.save(); c.globalCompositeOperation='screen';
        for(var rr=0;rr<6;rr++){
          var rx=(0.1+rr*0.16)*W+Math.sin(ts*0.4+rr)*W*0.02;
          var rg=c.createLinearGradient(0,Math.max(hy,0),0,H);
          rg.addColorStop(0,'rgba(255,255,255,'+(0.32*under*(1-settle*0.55)).toFixed(3)+')'); rg.addColorStop(1,'rgba(255,255,255,0)');
          c.fillStyle=rg; c.save(); c.translate(rx,Math.max(hy,0)); c.rotate(0.22); c.fillRect(-W*0.025,0,W*0.055,H*1.2); c.restore();
        }
        c.restore();
      }
      // --- the drop of story: a warm spark with a trail, falling to the surface
      if(t<T.drop+60){
        var dp=ease(Math.max(0,(t-120)/(T.drop-120)));
        var dy=lerp(-60,horizon,dp*dp);
        c.save(); c.globalCompositeOperation='lighter';
        for(var tr=0;tr<10;tr++){ var ty=dy-tr*18*(0.4+dp); c.globalAlpha=0.5*(1-tr/10); c.drawImage(glow,cx-10+tr*0.3,ty-10,20,20); }
        c.globalAlpha=1; c.drawImage(glow,cx-28,dy-28,56,56);
        c.fillStyle='#fff8e6'; c.beginPath(); c.ellipse(cx,dy,4.5,7,0,0,6.283); c.fill();
        c.restore();
      }
      // --- impact: rings across the water (seen from above), then a flash
      if(t>T.drop-40&&t<T.plunge){
        var k=(t-T.drop)/(T.plunge-T.drop);
        for(var ri=0;ri<4;ri++){
          var rk=Math.max(0,k-ri*0.12); if(rk<=0) continue;
          var rw=W*0.55*Math.sqrt(rk);
          c.strokeStyle='rgba(255,255,255,'+(0.75*(1-rk)).toFixed(3)+')'; c.lineWidth=2.2*(1-rk)+0.4;
          c.beginPath(); c.ellipse(cx,hy,rw,rw*0.1,0,0,6.283); c.stroke();
        }
        var fl=Math.max(0,1-Math.abs(t-T.drop)/260);
        if(fl>0){ c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha=fl; c.drawImage(glow,cx-W*0.24,hy-W*0.24,W*0.48,W*0.48); c.restore(); }
      }
      // --- bubbles streaming up past the camera
      if(under>0.05){
        c.lineWidth=1.1;
        for(var bb=0;bb<bub.length;bb++){
          var q=bub[bb];
          var qy=q.y-(t-T.impact)*0.32*q.sp-plunge*H*0.6;
          qy=((qy%(H*1.6))+H*1.6)%(H*1.6)-H*0.2;
          var qx=q.x+Math.sin(ts*2+q.ph)*7;
          c.strokeStyle='rgba(255,255,255,'+(0.7*under*(1-settle*0.6)).toFixed(3)+')';
          c.beginPath(); c.arc(qx,qy,q.r,0,6.283); c.stroke();
        }
      }
      // --- the light of story: bursts up, sinks with us, then gathers into the wordmark and becomes ink
      if(t>=T.drop){
        if(!targeted&&t>T.impact){ targeted=true; sampleTargets(); }
        var gather=ease((t-T.plunge+200)/(T.gather-T.plunge));
        var ink=ease((t-T.gather+500)/700);
        c.save();
        for(var pi=0;pi<P.length;pi++){
          var p=P[pi];
          if(t<T.plunge){
            if(t<T.drop+260){
              // a fountain of light from the impact
              p.vy+=0.32; p.x+=p.vx; p.y+=p.vy;
            } else {
              // then every mote finds its own orbit: a wide, slow galaxy of light around us
              var ang=p.a0+ts*(0.45+p.d*1.1)*p.dir, rad=Math.min(W,H)*(0.08+0.4*p.r0);
              var ox=cx+Math.cos(ang)*rad*1.6, oy=H*0.5+Math.sin(ang)*rad*0.62;
              p.x+=(ox-p.x)*0.045; p.y+=(oy-p.y)*0.045;
            }
            p.y+=(hy-(p._hy==null?hy:p._hy));
            p.sx=p.x; p.sy=p.y;
          }
          var gk=ease((gather-p.d*0.5)/(1-p.d*0.5));
          var px=lerp(p.sx,p.tx,gk)+Math.sin(ts*3+p.tw)*(1-gk)*14, py=lerp(p.sy,p.ty,gk)+Math.cos(ts*2.4+p.tw)*(1-gk)*10;
          var size=p.s*(1+(1-gk)*0.8);
          if(ink<0.98){
            c.globalCompositeOperation='lighter';
            c.globalAlpha=(0.55+0.45*Math.sin(ts*5+p.tw))*(1-ink);
            c.drawImage(glow,px-size*3,py-size*3,size*6,size*6);
          }
          if(ink>0.02){
            c.globalCompositeOperation='source-over';
            c.globalAlpha=ink; c.fillStyle='#141C30';
            c.fillRect(px-size*0.75,py-size*0.75,size*1.5,size*1.5);
          }
        }
        P._hy=hy; for(var ph=0;ph<P.length;ph++) P[ph]._hy=hy;
        c.restore();
      }
      // --- far below, the book answers once
      var call=Math.max(0,1-Math.abs(t-(T.gather-150))/500);
      if(call>0){ c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha=0.55*call; c.drawImage(glow,cx-W*0.5,H-W*0.12,W,W*0.5); c.restore(); }
      // --- handoff: the site takes over underneath, the scene fades away on top
      if(!released&&t>=T.handoff){
        released=true;
        self.sky.style.background='linear-gradient(180deg,'+homeSky[0]+' 0%,'+homeSky[1]+' 100%)';
        self._layoutGeometryDirty=true; self._sceneDirty=true; self.introDone=true;
        cv.style.pointerEvents='none';
      }
      if(released){ cv.style.opacity=String(Math.max(0,1-(t-T.handoff)/(T.end-T.handoff))); }
      if(t>=T.end){
        finished=true; cv.remove();
        window.removeEventListener('wheel',skip); window.removeEventListener('touchstart',skip); window.removeEventListener('keydown',skip); cv.removeEventListener('pointerdown',skip);
        try{ sessionStorage.setItem('tt_intro_home_v5','1'); }catch(e){}
        return;
      }
      requestAnimationFrame(frame);
    }
    // any input jumps to the moment the light gathers
    var skip=function(){ var t=performance.now()-self._introV2Start+skipShift; if(t<T.plunge){ skipShift+=T.plunge-t; } };
    window.addEventListener('wheel',skip,{passive:true}); window.addEventListener('touchstart',skip,{passive:true}); window.addEventListener('keydown',skip); cv.addEventListener('pointerdown',skip);
    this.introDone=false;
    this._introV2Start=performance.now();
    requestAnimationFrame(frame);
  }

  skipIntro(){
    if(this.introDone||!this.introStart) return;
    var elapsed=performance.now()-this.introStart;
    var handoffStart=this.INTRO_PLUNGE_MS*0.56;
    if(elapsed<handoffStart) this.introStart=performance.now()-handoffStart;
  }

  updateIntro(now){
    if(this._introV2) return;
    if(!this.introEl){ this.introDone=true; return; }
    var elapsed=now-this.introStart;
    var diveP=this.cl(elapsed/this.INTRO_PLUNGE_MS,0,1);
    var t=elapsed/1000;
    var handoff=this.smooth(this.INTRO_PLUNGE_MS*0.56,this.INTRO_MS*0.82,elapsed);
    var structure=this.smooth(0.02,0.98,handoff);
    var backgroundBlend=this.smooth(0.04,0.72,handoff);
    var lightSettle=this.smooth(0.38,0.78,handoff);
    var curtain=this.smooth(0.52,0.90,handoff);
    var plunge=this.smooth(0.04,0.36,diveP);
    var deep=this.smooth(0.20,0.48,diveP);
    var entryHit=this.smooth(0.13,0.21,diveP)*(1-this.smooth(0.29,0.38,diveP));
    var impact=entryHit;
    var shakeScale=this._introMobile?0.46:0.88;
    var shx=(Math.sin(t*78)*10+Math.sin(t*31)*4)*impact*shakeScale;
    var shy=(Math.cos(t*69)*7+Math.sin(t*27)*3)*impact*shakeScale;
    var skyY=-22-76*plunge;
    var seaY=104-110*plunge;

    this.introEl.style.opacity='1';
    this.introEl.style.transform='none';
    this.introEl.style.backgroundColor='transparent';
    this.introEl.style.pointerEvents=handoff>0.72?'none':'auto';

    // The underwater plate and the live HOME sky share one continuously mixed gradient.
    var homeSky=this._introHomeSky||['#eef6f4','#dceef0'];
    var sharedTop=this.mix(this._introWaterTop||'#c9ecee',homeSky[0],backgroundBlend);
    var sharedBottom=this.mix(this._introWaterBottom||'#5b9fb0',homeSky[1],backgroundBlend);
    var sharedBackground=backgroundBlend>=0.999&&this._introHomeBackground?this._introHomeBackground:'linear-gradient(180deg,'+sharedTop+' 0%,'+sharedBottom+' 100%)';
    if(this.iSeaBg){ this.iSeaBg.style.opacity='1'; this.iSeaBg.style.background=sharedBackground; }
    if(this.sky&&this._skyBackground!==sharedBackground){ this.sky.style.background=sharedBackground; this._skyBackground=sharedBackground; }

    // Keep the scene opaque. Its water texture withdraws as a moving surface mask.
    if(this.iScene){
      this.iScene.style.opacity='1';
      this.iScene.style.transform='translate3d(0,0,0) scale(1)';
      var sceneClip='none';
      if(curtain>=0.999){
        sceneClip='inset(0 0 100% 0)';
      }else if(curtain>0.001){
        var edge=108-118*curtain;
        var edgeA=edge+Math.sin(t*2.4)*0.9;
        var edgeB=edge+Math.sin(t*2.1+1.8)*1.1;
        var edgeC=edge+Math.sin(t*2.7+3.2)*0.8;
        sceneClip='polygon(0 0,100% 0,100% '+edge.toFixed(2)+'%,82% '+edgeA.toFixed(2)+'%,64% '+edgeB.toFixed(2)+'%,46% '+edgeC.toFixed(2)+'%,28% '+edgeA.toFixed(2)+'%,12% '+edgeB.toFixed(2)+'%,0 '+edge.toFixed(2)+'%)';
      }
      this.iScene.style.clipPath=sceneClip;
      this.iScene.style.webkitClipPath=sceneClip;
    }
    if(this.iSky) this.iSky.style.transform='translate3d('+shx.toFixed(1)+'px,calc('+skyY.toFixed(2)+'% + '+shy.toFixed(1)+'px),0) scale('+(1+impact*0.025).toFixed(3)+')';
    if(this.iCloudWrap) this.iCloudWrap.style.transform='translate3d(0,'+(-plunge*18).toFixed(1)+'vh,0)';
    if(this.iWaves) this.iWaves.style.transform='scale('+(1+0.72*plunge).toFixed(3)+')';
    if(this.iSea) this.iSea.style.transform='translate3d('+shx.toFixed(1)+'px,'+seaY.toFixed(2)+'%,0) scale('+(1+impact*0.025).toFixed(3)+')';

    var underwater=plunge;
    if(this.iUnder) this.iUnder.style.opacity=(underwater*(1-lightSettle)).toFixed(3);
    if(this.iOverlight){
      this.iOverlight.style.transformOrigin='50% 0%';
      this.iOverlight.style.transform='translate3d(0,'+(-deep*18).toFixed(1)+'%,0) scale('+(0.96-deep*0.1).toFixed(3)+')';
      this.iOverlight.style.opacity=(0.75-deep*0.28).toFixed(3);
    }
    if(this.iShade) this.iShade.style.opacity=(deep*0.92).toFixed(3);

    var descentMotion=plunge*(1-deep*0.42);
    for(var si=0;si<this.iStreaks.length;si++){
      var streak=this.iStreaks[si];
      if(descentMotion<0.01){ streak.style.opacity='0'; continue; }
      var phase=((diveP*4.2/streak._sp2)+streak._st)%1;
      var normalStreakY=(112-phase*142)*(window.innerHeight||1)/100;
      var targetStreakX=Number.isFinite(streak._targetX)?streak._targetX:0;
      var targetStreakY=Number.isFinite(streak._targetY)?streak._targetY:normalStreakY;
      var streakX=targetStreakX*structure;
      var streakY=normalStreakY*(1-structure)+targetStreakY*structure;
      var streakScale=(1+descentMotion*0.75)*(1-structure*0.94);
      streak.style.transform='translate3d('+streakX.toFixed(1)+'px,'+streakY.toFixed(1)+'px,0) scaleY('+streakScale.toFixed(3)+')';
      streak.style.opacity=(Math.sin(Math.PI*phase)*descentMotion*0.82).toFixed(3);
    }

    for(var bi=0;bi<this.iBubs.length;bi++){
      var bubble=this.iBubs[bi];
      if(underwater<0.02){ bubble.style.opacity='0'; continue; }
      var bp=((diveP*2.8/bubble._spd)+bubble._st)%1;
      var normalBubbleX=Math.sin(bp*7+bubble._wob)*16;
      var normalBubbleY=(112-bp*136)*(window.innerHeight||1)/100;
      var targetBubbleX=Number.isFinite(bubble._targetX)?bubble._targetX:normalBubbleX;
      var targetBubbleY=Number.isFinite(bubble._targetY)?bubble._targetY:normalBubbleY;
      var bubbleX=normalBubbleX*(1-structure)+targetBubbleX*structure;
      var bubbleY=normalBubbleY*(1-structure)+targetBubbleY*structure;
      var bubbleScale=(0.65+bp*0.75)*(1-structure*0.95);
      bubble.style.transform='translate3d('+bubbleX.toFixed(1)+'px,'+bubbleY.toFixed(1)+'px,0) scale('+bubbleScale.toFixed(3)+')';
      bubble.style.opacity=(Math.sin(Math.PI*bp)*underwater*0.82).toFixed(3);
    }

    for(var di=0;di<this.iDrops.length;di++) this.iDrops[di].style.opacity='0';

    if(this.iFoamL){
      this.iFoamL.style.opacity=Math.min(1,entryHit*1.35).toFixed(3);
      this.iFoamL.style.transform='translate3d(0,'+(seaY-3).toFixed(1)+'vh,0) scaleY('+(1+impact*0.9).toFixed(2)+')';
    }
    if(this.iFlash){
      this.iFlash.style.opacity=Math.min(0.58,entryHit*0.52).toFixed(3);
      this.iFlash.style.transform='scale('+(0.82+plunge*0.06).toFixed(3)+')';
    }
    if(this.iSkip){
      this.iSkip.style.color=this.mix('#375a64','#e8f6fa',underwater);
      this.iSkip.style.opacity=(this.smooth(0.01,0.05,diveP)*(1-this.smooth(0.18,0.28,diveP))*0.55).toFixed(3);
    }

    // Build the actual HOME in the underwater frame with masks, drawn paths and scale.
    var assemblySchedule={
      ghost:[0.00,0.34], eyebrow:[0.06,0.32], wave:[0.08,0.60], title:[0.16,0.52],
      subtitle:[0.34,0.66], description:[0.46,0.76], actions:[0.58,0.88], hint:[0.70,0.97]
    };
    for(var ai=0;ai<this._introHomeAssembly.length;ai++){
      var assembly=this._introHomeAssembly[ai];
      var timing=assemblySchedule[assembly.kind]||[0.18,0.72];
      var aq=this.smooth(timing[0],timing[1],handoff);
      var ae=1-Math.pow(1-aq,3);
      var clip='inset(0 0 0 0)', assemblyTransform=assembly.targetTransform||'';
      assembly.el.style.opacity=String(assembly.finalOpacity);
      if(assembly.kind==='ghost'){
        clip='circle('+(ae*150).toFixed(2)+'% at 50% 50%)';
        assemblyTransform+=' scale('+(0.72+ae*0.28).toFixed(4)+')';
      }else if(assembly.kind==='title'){
        clip='inset(0 '+((1-ae)*50).toFixed(2)+'% 0 '+((1-ae)*50).toFixed(2)+'%)';
        assemblyTransform+=' translate3d(0,'+((1-ae)*12).toFixed(1)+'px,0) scaleX('+(0.72+ae*0.28).toFixed(4)+') scaleY('+(0.92+ae*0.08).toFixed(4)+')';
      }else if(assembly.kind==='eyebrow'){
        clip='inset(0 '+((1-ae)*50).toFixed(2)+'% 0 '+((1-ae)*50).toFixed(2)+'%)';
        assemblyTransform+=' translate3d(0,'+((1-ae)*8).toFixed(1)+'px,0) scaleX('+(0.78+ae*0.22).toFixed(4)+')';
        assembly.el.style.letterSpacing=(0.28+(1-ae)*0.18).toFixed(3)+'em';
      }else if(assembly.kind==='subtitle'||assembly.kind==='description'){
        clip='inset('+((1-ae)*100).toFixed(2)+'% 0 0 0)';
        assemblyTransform+=' translate3d(0,'+((1-ae)*18).toFixed(1)+'px,0)';
      }else if(assembly.kind==='actions'){
        clip='inset(0 '+((1-ae)*50).toFixed(2)+'% 0 '+((1-ae)*50).toFixed(2)+'% round 999px)';
        assemblyTransform+=' scaleX('+(0.76+ae*0.24).toFixed(4)+')';
      }else if(assembly.kind==='wave'){
        clip='inset(0 '+((1-ae)*50).toFixed(2)+'% 0 '+((1-ae)*50).toFixed(2)+'%)';
        assemblyTransform+=' translate3d(0,'+((1-ae)*16).toFixed(1)+'px,0)';
      }else{
        clip='inset(0 0 '+((1-ae)*100).toFixed(2)+'% 0)';
        assemblyTransform+=' translate3d(0,'+((1-ae)*14).toFixed(1)+'px,0)';
      }
      assembly.el.style.clipPath=clip;
      assembly.el.style.webkitClipPath=clip;
      assembly.el.style.transform=assemblyTransform.trim();
      for(var api=0;api<assembly.wavePaths.length;api++){
        var assemblyPath=assembly.wavePaths[api];
        var pathQ=this.smooth(api*0.07,Math.min(1,0.72+api*0.06),aq);
        if(assemblyPath.length>0) assemblyPath.el.style.strokeDashoffset=(assemblyPath.length*(1-pathQ)).toFixed(2);
      }
      for(var adi=0;adi<assembly.waveDots.length;adi++){
        var dotQ=this.smooth(0.56+adi*0.07,0.78+adi*0.055,aq);
        assembly.waveDots[adi].el.style.transform='scale('+dotQ.toFixed(3)+')';
      }
      if(assembly.hintLine) assembly.hintLine.el.style.transform='scaleY('+this.smooth(0.05,0.72,aq).toFixed(3)+')';
    }
    for(var li=0;li<this._introChromeTargets.length;li++){
      var chromeItem=this._introChromeTargets[li];
      var cq=this.smooth(0.62+li*0.045,0.84+li*0.035,handoff);
      var chromeFromLeft=chromeItem.index===0||chromeItem.index===3;
      var chromeInset=((1-cq)*100).toFixed(2);
      var chromeClip=chromeFromLeft?'inset(0 '+chromeInset+'% 0 0)':'inset(0 0 0 '+chromeInset+'%)';
      chromeItem.el.style.opacity='1';
      chromeItem.el.style.clipPath=chromeClip;
      chromeItem.el.style.webkitClipPath=chromeClip;
      chromeItem.el.style.transform=(chromeItem.transform?chromeItem.transform+' ':'')+'translate3d('+((chromeFromLeft?-42:42)*(1-cq)).toFixed(1)+'px,0,0)';
    }

    // The live HOME FX starts under the same water mask and continues after the handoff.
    if(handoff>0.02&&this.ctx&&this.P&&this.P[this.mood]) this.draw(0,this.P[this.mood],this._introMobile);

    if(elapsed>=this.INTRO_MS && this._finishIntro) this._finishIntro();
  }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               

  // utilities
           cl(v,a,b){return v<a?a:v>b?b:v;}
  smooth(a,b,x){var t=this.cl((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  hx(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
  mix(h1,h2,t){var a=this.hx(h1),b=this.hx(h2);return 'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')';}
  rgba(c1,c2,t){return 'rgba('+c1.map((v,i)=>Math.round(v+(c2[i]-v)*t)).join(',')+')';}
  collectMotionEls(){
    this.spins=Array.from(document.querySelectorAll('[data-spin]'));
    this.floats=Array.from(document.querySelectorAll('[data-float]'));
    this.floatCards=Array.from(document.querySelectorAll('.lift'));
    this.floatCards.forEach((el,i)=>{ if(el._fph==null){ el._fph=i*1.7; el._fpy=2.0+(i%3)*0.5; el._fpx=2.6+(i%4)*0.6; } });
    this.eqs=Array.from(document.querySelectorAll('[data-eq]'));
    this.bobs=Array.from(document.querySelectorAll('[data-bob]'));
    this.drifts=Array.from(document.querySelectorAll('[data-drift]'));
    this.motionEls=Array.from(new Set([].concat(this.spins,this.floats,this.floatCards,this.eqs,this.bobs,this.drifts)));
  }
  refreshLayoutGeometry(layoutHeight){
    this.collectMotionEls();
    var scEl=this.scroller, scrollTop=scEl?scEl.scrollTop:window.scrollY;
    var rootTop=scEl?scEl.getBoundingClientRect().top:0;
    for(var i=0;i<this.motionEls.length;i++){
      var el=this.motionEls[i], rect=el.getBoundingClientRect();
      el._motionBounds={top:rect.top-rootTop+scrollTop,height:rect.height};
    }
    this.sections=['c-home','c-translation','c-projects','c-members','c-works','c-news','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
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
      var anchor=this._bridgeRun.index===-1?this.transSec.offsetTop:this._bridgeOffsets[this._bridgeRun.index];
      if(Number.isFinite(anchor)) this.scroller.scrollTo({top:anchor,behavior:'auto'});
    }
    this._deepBookGeometry=null;
    var bookEl=document.getElementById('deep-book-svg');
    if(bookEl){
      var bookRect=bookEl.getBoundingClientRect();
      if(bookRect.width){
        var bookFloat=bookEl.closest?bookEl.closest('[data-float]'):null;
        var currentFloatY=bookFloat&&Number.isFinite(bookFloat._floatY)?bookFloat._floatY:0;
        this._deepBookGeometry={x:bookRect.left+bookRect.width/2,docY:bookRect.top+scrollTop+bookRect.height*0.30-currentFloatY,floatEl:bookFloat};
      }
    }
    this._layoutGeometryHeight=layoutHeight==null?(scEl?scEl.scrollHeight:document.documentElement.scrollHeight):layoutHeight;
    this._layoutGeometryDirty=false;
  }
  // Depth journey: every chapter holds its own water layer (palette depth 0..1 and metres).
  // The descent to the next layer happens between a chapter's bridge and the next chapter,
  // so the sea visibly gets deeper at each handoff instead of drifting with page length.
  _buildDepthKeys(layoutHeight){
    var layers=[['c-home',0.2,0],['c-translation',0.26,60],['c-projects',0.34,200],['c-members',0.45,600],['c-works',0.6,1200],['c-news',0.7,2000],['c-contact',0.84,3200]];
    var scEl=this.scroller, bridgeTops=(this._bridgeOffsets||[]).filter(Number.isFinite), keys=[];
    for(var i=0;i<layers.length;i++){
      var el=document.getElementById(layers[i][0]); if(!el) continue;
      var top=el.offsetTop, next=i+1<layers.length?document.getElementById(layers[i+1][0]):null;
      if(keys.length&&top<=keys[keys.length-1][0]) top=keys[keys.length-1][0]+1;
      keys.push([top,layers[i][1],layers[i][2]]);
      if(next&&next.offsetTop>top+2){
        var hold=top+el.offsetHeight*0.5;
        bridgeTops.forEach(function(b){ if(b>top&&b<next.offsetTop) hold=Math.max(hold,b); });
        keys.push([Math.min(hold,next.offsetTop-1),layers[i][1],layers[i][2]]);
      }
    }
    var maxScroll=Math.max(0,(layoutHeight||(scEl?scEl.scrollHeight:0))-(scEl?scEl.clientHeight:0));
    keys.push([Math.max(maxScroll,keys.length?keys[keys.length-1][0]+1:1),0.95,4000]); // sea floor: the book
    // the gauge counts every metre: linear between chapter tops, not held per chapter
    this._meterKeys=keys.filter(function(k,i){ return i===0||i===keys.length-1||k[2]!==keys[i-1][2]; }).map(function(k){ return [k[0],k[2]]; });
    return keys;
  }
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
  }
  _metresAt(sc){
    var k=this._meterKeys;
    if(!k||!k.length) return 0;
    if(sc<=k[0][0]) return k[0][1];
    for(var i=0;i<k.length-1;i++){
      if(sc<=k[i+1][0]) return k[i][1]+(k[i+1][1]-k[i][1])*this.cl((sc-k[i][0])/((k[i+1][0]-k[i][0])||1),0,1);
    }
    return k[k.length-1][1];
  }
  _depthZone(m){
    var lang=this.lang||'kr', i=m>=3800?3:(m>=1000?2:(m>=200?1:0));
    return ({kr:['표층','중층','심해','마법의 서'],en:['Sunlight zone','Twilight zone','Midnight zone','The Book'],jp:['表層','中深層','深海','魔法の書']}[lang]||[])[i]||'';
  }
  isNearViewport(el, margin, bounds, scrollTop, viewportHeight){
    if(!el || !el.getBoundingClientRect) return false;
    var vh=viewportHeight==null?(window.innerHeight||800):viewportHeight, m=margin==null?vh*0.75:margin;
    if(bounds){
      var top=bounds.top-(scrollTop==null?(this.scroller?this.scroller.scrollTop:window.scrollY):scrollTop);
      return top+bounds.height>=-m && top<=vh+m;
    }
    var b=el.getBoundingClientRect();
    return b.bottom>=-m && b.top<=vh+m;
  }
  setMotionIdle(el, idle){
    if(!el || el._motionIdle === idle) return;
    el._motionIdle = idle;
    el.style.willChange = idle ? 'auto' : 'transform,opacity';
    el.style.setProperty('--tt-motion-play-state',idle?'paused':'running');
  }
  // Skip unchanged root styles between frames.
  setCssVar(style, name, value){
    this._cssVarCache = this._cssVarCache || {};
    if(this._cssVarCache[name] === value) return;
    this._cssVarCache[name] = value;
    style.setProperty(name, value);
  }
  isMobileMotion(){
    return window.innerWidth <= 760;
  }
  markScrollIntent(sc){
    var now=performance.now();
    var pos = sc != null ? sc : (this.scroller ? this.scroller.scrollTop : window.scrollY);
    if(this._lastScrollSampleT != null){
      var dt=Math.max(16, now-this._lastScrollSampleT);
      this._scrollSpeed=Math.abs(pos-this._lastScrollSampleY)/dt;
      if(this.isMobileMotion() && this._scrollSpeed>1.15) this._fastScrollUntil=now+320;
    }
    this._lastScrollSampleT=now;
    this._lastScrollSampleY=pos;
    return now;
  }
  isFastMobileScroll(now){
    return !this._bridgeRun && this.isMobileMotion() && ((now||performance.now()) < (this._fastScrollUntil||0));
  }
  scrollToManaged(top, behavior, cooldown){
    var scEl=this.scroller || document.getElementById('content');
    if(!scEl || !isFinite(top)) return;
    var now=performance.now();
    if(this.isMobileMotion()){
      if(now < (this._managedScrollUntil||0)) return;
      if(this.isFastMobileScroll(now)) behavior='auto';
      this._managedScrollUntil=now+(cooldown||420);
    }
    scEl.scrollTo({top:top, behavior:behavior||'smooth'});
  }
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
  }

  skyColors(stops,p){
    var s=stops;
    for(var i=0;i<s.length-1;i++){
      if(p<=s[i+1][0]){
        var t=(p-s[i][0])/(s[i+1][0]-s[i][0]||1);
        return [this.mix(s[i][1],s[i+1][1],t), this.mix(s[i][2],s[i+1][2],t)];
      }
    }
    return [s[s.length-1][1], s[s.length-1][2]];
  }

  loop = (frameTime)=>{
    this.raf=0;
    if(document.hidden) return;
    if(this._reduceMotion===undefined) this._reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var frameNow = Number.isFinite(frameTime) ? frameTime : performance.now();
    var minFrameMs = this._reduceMotion ? 64 : (!this.introDone ? (this._introMobile?34:24) : (this.isMobileMotion() ? 34 : 1000/60));
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
      this.updateIntro(frameNow);
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
      if(this._bridgeSeen[-1]&&this.isNearViewport(this.transSec,scEl.clientHeight*0.35)) this.updateTranslation(scEl,(nowLoop-this.t0)/1000);
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
      this.setCssVar(r,'--soft',this.mix('#44505F','#c4d4ee',tn));
      this.setCssVar(r,'--paper',this.mix('#fffdf8','#0b1330',tn));
      var hs=(1-Math.abs(tn-0.5)*2);                    // 0 at extremes, 1 at the crossover
      var halo = tn<0.5
        ? '0 1px 2px rgba(255,255,255,'+(0.25+0.5*hs).toFixed(2)+'),0 0 18px rgba(255,255,255,'+(0.18+0.4*hs).toFixed(2)+')'
        : '0 1px 2px rgba(3,11,22,'+(0.35+0.45*hs).toFixed(2)+'),0 0 20px rgba(3,11,22,'+(0.25+0.45*hs).toFixed(2)+')';
      this.setCssVar(r,'--halo',halo);
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
        this.sections=['c-home','c-translation','c-projects','c-members','c-works','c-news','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
      }
      var act=0, line=vh2;
      for(var k=0;k<this.sections.length;k++){
        if(this.sections[k].getBoundingClientRect().top <= line) act=k;
      }
      if(act!==this.lastActive){
        for(var j=0;j<7;j++){
          var nb=document.getElementById('nav-'+j); if(!nb) continue;
          var on=j===act;
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
        if(previousChapter==='works' && activeChapter!=='works') this.pauseWorksAudio();
        try{ window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_CHANGE',{detail:{chapter:activeChapter,previous:previousChapter}})); }catch(_e){}
        this.lastActive=act;
      }
      var pb=document.getElementById('pbar'); if(pb) pb.style.width = (8+p*92)+'%';
      this.scrollCenter = sc + vh2;
      this.scrollP = p;
    }
    if((sceneDirty||this._bridgeRun?.index===-1) && this.transSec && this.isNearViewport(this.transSec,scEl.clientHeight*0.35)) this.updateTranslation(scEl,tA);
    this.draw(n, pal, fastMobile);
    this.raf = requestAnimationFrame(this.loop);
  }

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
    var awake=bookG?this.smooth(H*1.05,H*0.5,bookScreenY):0;
    if(awake>0.01){
      var abx=bookG.x, aby=bookScreenY;
      var bloomR=Math.max(W,H)*(0.35+0.45*awake);
      var bloom=c.createRadialGradient(abx,aby,0,abx,aby,bloomR);
      bloom.addColorStop(0,'rgba(255,226,160,'+(0.55*awake).toFixed(3)+')'); bloom.addColorStop(0.3,'rgba(255,214,140,'+(0.2*awake).toFixed(3)+')'); bloom.addColorStop(1,'rgba(255,214,140,0)');
      c.globalCompositeOperation='screen';
      c.fillStyle=bloom; c.fillRect(0,0,W,H);
      var colW=W*(0.04+0.05*awake)*(0.9+0.1*Math.sin(tw*1.3));
      var column=c.createLinearGradient(0,aby,0,0);
      column.addColorStop(0,'rgba(255,236,190,'+(0.45*awake).toFixed(3)+')'); column.addColorStop(1,'rgba(255,236,190,0)');
      c.fillStyle=column; c.fillRect(abx-colW/2,0,colW,Math.max(0,aby));
      c.globalCompositeOperation='source-over';
    }
    var awakeNow=awake>0.6;
    if(this._bookAwake!==awakeNow){ this._bookAwake=awakeNow; document.body.classList.toggle('tt-book-awake',awakeNow); }
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
        c.font='600 '+sz.toFixed(0)+"px 'Quicksand','Noto Sans JP',sans-serif";
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
      this.transGlint=null;
    } else {
      this.drawInk(time);
      this.drawGlint(this.transGlint, pal.accent2, time, 70);
    }
    this.drawRail(n, pal, time);
  }

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
  }
  spawnInk(x,y){
    if(!this.inks) this.inks=[];
    var pals=[[86,201,210],[199,154,78],[226,127,168],[120,150,255],[120,210,170],[255,196,120]];
    var col=pals[(Math.random()*pals.length)|0];
    var blobs=[]; var nb=4+(Math.random()*3|0);
    for(var i=0;i<nb;i++){ blobs.push({ox:(Math.random()*2-1)*40,oy:(Math.random()*2-1)*40,r0:6+Math.random()*14,grow:60+Math.random()*120,ph:Math.random()*6.28,a:0.6+Math.random()*0.4}); }
    this.inks.push({x:x,y:y,col:col,t:performance.now(),life:1700+Math.random()*900,blobs:blobs});
    if(this.inks.length>14) this.inks.shift();
  }

  // Shinkai-ish light particles: dissolving letters rise as glints/stars
  drawGlint(g, accent, time, rise){
    if(!g) return;
    var c=this.ctx, ar=this.hx(accent);
    if(!this._glints){ this._glints=Array.from({length:46},(_,i)=>({rx:Math.random()-0.5, ry:Math.random()-0.5, sp:Math.random()*0.5+0.4, ph:Math.random()*6.28, r:Math.random()*1.8+0.7})); }
    for(var i=0;i<this._glints.length;i++){
      var p=this._glints[i];
      var t=(time*p.sp + p.ph)%1;
      var x=g.x + p.rx*g.w*0.96;
      var y=g.y + p.ry*g.h - t*rise;          // drift upward
      var tw=0.5+0.5*Math.sin(time*3+p.ph);
      var a=g.k*tw*(1-t)*0.9;
      if(a<=0.01) continue;
      c.globalAlpha=a*0.3; c.fillStyle='rgb('+ar[0]+','+ar[1]+','+ar[2]+')';
      c.beginPath(); c.arc(x,y,p.r*3.2,0,6.283); c.fill();
      c.globalAlpha=a; c.fillStyle='rgb('+Math.min(255,ar[0]+90)+','+Math.min(255,ar[1]+90)+','+Math.min(255,ar[2]+90)+')';
      c.beginPath(); c.arc(x,y,p.r,0,6.283); c.fill();
    }
    c.globalAlpha=1;
  }

  // The score playhead: the whole page is one staff scrolling past a fixed reading head.
  // Each chapter's note ignites exactly as it reaches the head -> the reason the chapter "plays".
  drawRail(n, pal, time){
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
    c.font='700 12px "Quicksand","Nanum Gothic","Noto Sans JP",sans-serif';
    c.globalAlpha=0.95; c.fillText(Math.round(metres).toLocaleString('en-US')+'m', railX+20, py-7);
    c.font='600 10px "Quicksand","Nanum Gothic","Noto Sans JP",sans-serif';
    c.globalAlpha=0.7; c.fillText(this._depthZone(metres)+' · '+Math.round((this.scrollP||0)*100)+'%', railX+20, py+9); c.globalAlpha=1;
  }

  // audio
  bridgeTypeForIndex(i){
    var bridge = this.BRIDGES && this.BRIDGES[i];
    var id = String((bridge && bridge.id) || '').toLowerCase();
    var byId = {
      'translation-projects': 'orbs',
      'projects-members': 'gather',
      'members-works': 'bloom',
      'works-news': 'ripple',
      'news-contact': 'page'
    };
    return byId[id] || ['orbs','gather','bloom','ripple','page'][i] || 'orbs';
  }

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
  }

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
  }
  syncContactEmailLink(){
    var em=document.getElementById('email-link');
    if(!em) return;
    var contact = this.CONTACT || {};
    var link = contact.link || ('mailto:' + ['contact','taletone.net'].join(String.fromCharCode(64)));
    // Prefill the inquiry template in the visitor's language.
    if(contact.email && contact.mailSubject){
      link = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(contact.mailSubject) + (contact.mailTemplate ? '&body=' + encodeURIComponent(contact.mailTemplate) : '');
    }
    em.href = link;
    var label = contact.buttonLabel || 'Start a Project';
    var emLabel = em.querySelector('[data-email-label]');
    if(emLabel) emLabel.textContent = label;
    else em.textContent = label;
  }
  setLang(l){
    this.lang=l;
    document.documentElement.lang = l==='kr'?'ko':(l==='jp'?'ja':'en');
    var els=document.querySelectorAll('[data-en]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el._kr==null) el._kr = el.hasAttribute('data-kr')?el.getAttribute('data-kr'):el.textContent;
      var v = l==='kr' ? el._kr : el.getAttribute('data-'+l);
      if(v!=null) el.textContent=v;
    }
    // rebuild bridge words in the chosen language
    if(this.bridges){ for(var b=0;b<this.bridges.length;b++){ var bg=this.bridges[b]; if(bg._visual && bg._visual.parentNode) bg._visual.parentNode.removeChild(bg._visual); bg._visual=null; bg._visualItems=null; bg._words=null; bg.innerHTML=''; } }
    // highlight active language button
    var langs=['kr','en','jp'];
    for(var k=0;k<langs.length;k++){ var btn=document.getElementById('lang-'+langs[k]); if(btn){ var on=langs[k]===l; btn.style.background=on?'var(--ink,#141C30)':'none'; btn.style.color=on?'var(--paper,#fffdf8)':'var(--ink,#141C30)'; btn.style.border='0'; btn.style.outline='0'; btn.style.boxShadow='none'; btn.style.borderRadius='999px'; btn.style.overflow='hidden'; btn.style.backgroundClip='padding-box'; btn.style.appearance='none'; btn.style.webkitAppearance='none'; btn.style.webkitTapHighlightColor='transparent'; btn.style.minWidth='44px'; btn.style.minHeight='44px'; } }
    try{ localStorage.setItem('tt_lang', l); }catch(e){}
    try{ this._applyExternalContent(); this.forceUpdate(); this.syncContactEmailLink(); this.rebuildTranslationLine(); this._syncLangUrl(); this._localizeRouteLinks(); this._applySeoForCurrentPage(); if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.setMeta){ window.TALETONE_WORKS_API.setMeta((window.TALETONE_CONTENT||{}).worksMeta || this.WORKS_META || {}); } }catch(e){}
    clearTimeout(this._langRebuildTimer);
    this._langRebuildTimer=setTimeout(()=>{ try{ this.bridges = Array.from(document.querySelectorAll('[data-bridge]')); this.bridges.forEach(function(bg){ if(bg._visual && bg._visual.parentNode) bg._visual.parentNode.removeChild(bg._visual); bg._visual=null; bg._visualItems=null; bg._words=null; bg.innerHTML=''; bg.style.opacity='0'; }); this.tcaps = [0,1,2].map(i=>document.getElementById('tcap-'+i)); this.transFoot=document.getElementById('trans-foot'); this.taleLine=document.getElementById('tale-line'); this.rebuildTranslationLine(); this._layoutGeometryDirty=true; this._sceneDirty=true; }catch(_e){} }, 0);
  }

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
    function dot(vv, sx, sy, tx, ty, size, delay){
      var d=document.createElement('span'); d.className='tt-bridge-dot';
      d.style.setProperty('--dot', (size||7)+'px');
      d._sx=sx; d._sy=sy; d._tx=tx; d._ty=ty; d._delay=delay||0; d._ph=Math.random()*6.283;
      vv.appendChild(d); items.push(d); return d;
    }
    function spark(vv, sx, sy, tx, ty, size, delay){
      var s=document.createElement('i'); s.className='tt-bridge-spark';
      s.style.width=(size||3)+'px'; s.style.height=(size||3)+'px';
      s._sx=sx; s._sy=sy; s._tx=tx; s._ty=ty; s._delay=delay||0; s._ph=Math.random()*6.283;
      vv.appendChild(s); items.push(s); return s;
    }
    function thread(vv, x, y, rot, w){
      var th=document.createElement('i'); th.className='tt-bridge-thread';
      th._x=x; th._y=y; th._rot=rot; th.style.setProperty('--w',(w||160)+'px');
      vv.appendChild(th); items.push(th); return th;
    }

    if(type==='line'){
      v.innerHTML='<div class="tt-line-ritual"><i class="tt-line-echo e1"></i><i class="tt-one-line"></i><i class="tt-line-echo e2"></i><i class="tt-line-trail"></i><b class="tt-line-note">??/b></div>';
      var ritual=v.querySelector('.tt-line-ritual');
      for(var li=0, lineGlyphs=lightVisual?10:18; li<lineGlyphs; li++){
        var gx=-410+Math.random()*820, gy=(Math.random()*2-1)*92;
        var gl=document.createElement('i'); gl.className='tt-line-glyph';
        gl._gx=gx; gl._gy=gy; gl._delay=Math.random()*0.22; ritual.appendChild(gl); items.push(gl);
      }
      items=items.concat(Array.from(v.querySelectorAll('.tt-one-line,.tt-line-echo,.tt-line-trail,.tt-line-note')));
    } else if(type==='orbs'){
      // LISTEN v2 - the story RUSHES in as comet streams; the listener visibly thumps on each beat
      var field=document.createElement('div'); field.className='tt-orb-stage'; v.appendChild(field);
      var ear=document.createElement('i'); ear.className='tt-bridge-orb tt-listen-ear'; v.appendChild(ear); items.push(ear);
      var lring=document.createElement('i'); lring.className='tt-listen-ring'; v.appendChild(lring); items.push(lring);
      for(var la=0; la<3; la++){ var arc=document.createElement('i'); arc.className='tt-listen-arc'; arc._delay=la/3; v.appendChild(arc); items.push(arc); }
      for(var hh=0; hh<2; hh++){ var hr=document.createElement('i'); hr.className='tt-shock-ring'; hr._hit=hh; v.appendChild(hr); items.push(hr); }
      for(var oi=0, flowCount=lightVisual?16:40; oi<flowCount; oi++){
        var fd=dot(field,0,0,0,0,2.4+Math.random()*5,Math.random());
        fd._flow=1; fd._lane=(Math.random()*2-1); fd._amp=10+Math.random()*26; fd._spd=0.7+Math.random()*0.9;
      }
    } else if(type==='gather'){
      // KINDLE v2 - trembling build-up, then IGNITION: shockwave, spark burst, light wave rolling outward
      var field2=document.createElement('div'); field2.className='tt-orb-stage'; v.appendChild(field2);
      var halo=document.createElement('i'); halo.className='tt-kindle-halo'; v.appendChild(halo); items.push(halo);
      var kcore=document.createElement('i'); kcore.className='tt-kindle-core'; v.appendChild(kcore); items.push(kcore);
      var ksh=document.createElement('i'); ksh.className='tt-shock-ring'; ksh._kshock=1; v.appendChild(ksh); items.push(ksh);
      for(var bs=0, burstN=lightVisual?8:14; bs<burstN; bs++){ var ba=Math.random()*6.283, br2=110+Math.random()*190; var s2=spark(v,0,0,Math.cos(ba)*br2,Math.sin(ba)*br2*0.6,2.5+Math.random()*3,Math.random()*0.35); s2._burst=1; }
      for(var gi=0, moteCount=lightVisual?24:62; gi<moteCount; gi++){
        var ma=Math.random()*6.283, mr=64+Math.random()*300;
        var mx=Math.cos(ma)*mr, my=Math.sin(ma)*mr*.5;
        var md=dot(field2,mx,my,mx,my,2+Math.random()*4,Math.random()*0.3);
        md._mote=1; md._dist=Math.sqrt(mx*mx+my*my)||1;
      }
    } else if(type==='bloom'){
      // TOUCH -> SOUND -> BLOOM v2: hard contact flash + shockwave, beating waveform, petals spring open
      var st=document.createElement('div'); st.className='tt-bloom-stage'; v.appendChild(st);
      var tfl=document.createElement('i'); tfl.className='tt-flash-core'; tfl._tflash=1; v.appendChild(tfl); items.push(tfl);
      var bsh=document.createElement('i'); bsh.className='tt-shock-ring'; bsh._bshock=1; v.appendChild(bsh); items.push(bsh);
      var tr1=document.createElement('i'); tr1.className='tt-touch-ring'; tr1._delay=0; v.appendChild(tr1); items.push(tr1);
      var tr2=document.createElement('i'); tr2.className='tt-touch-ring'; tr2._delay=0.05; v.appendChild(tr2); items.push(tr2);
      for(var tk=0, tickCount=lightVisual?14:22; tk<tickCount; tk++){ var tick=document.createElement('i'); tick.className='tt-sound-tick'; tick._rot=tk*(360/tickCount); tick._ph=Math.random()*6.283; st.appendChild(tick); items.push(tick); }
      for(var p=0, pOut=lightVisual?9:12;p<pOut;p++){ var pe=document.createElement('i'); pe.className='tt-bloom-petal'; pe._rot=p*(360/pOut); pe._st=Math.random()*0.04; pe._layer=0; st.appendChild(pe); items.push(pe); }
      for(var p2=0, pIn=lightVisual?6:8;p2<pIn;p2++){ var pi2=document.createElement('i'); pi2.className='tt-bloom-petal tt-petal-in'; pi2._rot=p2*(360/pIn)+(180/pIn); pi2._st=0.03+Math.random()*0.04; pi2._layer=1; st.appendChild(pi2); items.push(pi2); }
      for(var sm=0; sm<8; sm++){ var sd=document.createElement('i'); sd.className='tt-stamen'; sd._rot=sm*45; sd._st=Math.random()*0.08; sd._ph=Math.random()*6.283; st.appendChild(sd); items.push(sd); }
      for(var gg=0, gOut=lightVisual?9:12; gg<gOut; gg++){ var gt2=document.createElement('i'); gt2.className='tt-petal-glint'; gt2._rot=gg*(360/gOut); gt2._st=Math.random()*0.04; gt2._layer=0; gt2._len=138; st.appendChild(gt2); items.push(gt2); }
      for(var br=0, rayCount=lightVisual?12:24;br<rayCount;br++){ var ray=document.createElement('i'); ray.className='tt-bloom-ray'; ray._rot=br*(360/rayCount); st.appendChild(ray); items.push(ray); }
      var core=document.createElement('i'); core.className='tt-bloom-core'; v.appendChild(core); items.push(core);
      for(var sp=0, sparkCount=lightVisual?18:40; sp<sparkCount; sp++){ var ax0=(Math.random()*2-1)*26; var s3=spark(v,ax0,12+Math.random()*14,ax0*(2.4+Math.random()*2.6),-(130+Math.random()*210),2+Math.random()*3,Math.random()); s3._rise=1; }
    } else if(type==='ripple'){
      // RESURFACE v2 - rings race outward, droplets launch in ballistic arcs and glint at the surface
      var current=document.createElement('i'); current.className='tt-ripple-current'; v.appendChild(current); items.push(current);
      var surf=document.createElement('i'); surf.className='tt-surface-line'; v.appendChild(surf); items.push(surf);
      for(var r=0, rippleRings=lightVisual?4:6;r<rippleRings;r++){ var ring2=document.createElement('i'); ring2.className='tt-ripple-ring'; ring2._delay=r*0.09; v.appendChild(ring2); items.push(ring2); }
      var field3=document.createElement('div'); field3.className='tt-orb-stage'; v.appendChild(field3);
      for(var rd=0, rippleDots=lightVisual?20:46;rd<rippleDots;rd++){
        var dr0=dot(field3,(Math.random()*2-1)*46,14+Math.random()*18,0,0,2.5+Math.random()*5,Math.random()*0.45);
        dr0._drop=1; dr0._dxv=(Math.random()*2-1)*(140+Math.random()*320); dr0._vyv=240+Math.random()*260; dr0._st0=Math.random();
      }
    } else if(type==='page'){
      // YOUR TURN v2 - the first note FALLS with gravity, bounces, and the staff rings like plucked strings
      var sst=document.createElement('div'); sst.className='tt-staff-stage'; v.appendChild(sst);
      for(var sl=0; sl<5; sl++){ var ln=document.createElement('i'); ln.className='tt-staff-line'; ln._idx=sl; ln.style.top=((sl-2)*24)+'px'; sst.appendChild(ln); items.push(ln); }
      var nsh=document.createElement('i'); nsh.className='tt-shock-ring tt-note-shock'; nsh._noteShock=1; sst.appendChild(nsh); items.push(nsh);
      var npulse=document.createElement('i'); npulse.className='tt-note-pulse'; sst.appendChild(npulse); items.push(npulse);
      var note=document.createElement('i'); note.className='tt-staff-note'; sst.appendChild(note); items.push(note);
      for(var pg=0, pageSparks=lightVisual?10:18; pg<pageSparks; pg++){ var ax=(Math.random()*2-1)*160; spark(v,(Math.random()*2-1)*10,24,ax,-40-Math.random()*130,2+Math.random()*2.5,Math.random()*0.12); }
    }
    bg._visual=v; bg._visualItems=items;
    return v;
  }                               

  setBridgeVisual(bg, type, prog, exit, time){
    var v=bg._visual; if(!v) return;
    // #1 impact envelope: a sharp gaussian at each motif's physical hit, drives camera + text kick
    var impEnv=0;
    if(type==='gather') impEnv=Math.exp(-Math.pow((prog-0.475)/0.018,2));
    else if(type==='page') impEnv=Math.exp(-Math.pow((prog-0.50)/0.014,2))+0.5*Math.exp(-Math.pow((prog-0.56)/0.011,2));
    else if(type==='bloom') impEnv=0.7*Math.exp(-Math.pow((prog-0.06)/0.015,2))+Math.exp(-Math.pow((prog-0.50)/0.022,2));
    else if(type==='ripple') impEnv=0.6*Math.exp(-Math.pow((prog-0.30)/0.025,2));
    bg._imp=impEnv;
    var show=this.smooth(0.00,0.055,prog)*(1-this.smooth(0.965,1.0,prog));
    v.style.opacity=(show*(1-exit)).toFixed(3);
    v.style.setProperty('--aura',(0.38+0.62*show).toFixed(3));
    var bridgeScale=(0.985+0.025*this.smooth(0.12,0.72,prog))*(window.innerWidth<=760?0.86:1);
    v.style.transform='translate(-50%,-50%) translate3d(0,'+(-10*exit).toFixed(1)+'px,0) scale('+bridgeScale.toFixed(3)+')';
    var items=bg._visualItems||[];
    if(type==='line'){
      var draw=v.querySelector('.tt-one-line'), echoes=v.querySelectorAll('.tt-line-echo'), note=v.querySelector('.tt-line-note'), trail=v.querySelector('.tt-line-trail');
      var line=this.smooth(0.05,0.30,prog);
      var move=this.smooth(0.27,0.60,prog);
      var flare=Math.sin(this.cl((prog-0.52)/0.18,0,1)*Math.PI);
      if(draw){ draw.style.transform='translate(-50%,-50%) scaleX('+line.toFixed(3)+')'; draw.style.opacity=(line*(1-exit)).toFixed(3); }
      for(var ei=0;ei<echoes.length;ei++){
        var ep=this.smooth(0.20+ei*0.04,0.54+ei*0.05,prog);
        echoes[ei].style.transform='translate(-50%,-50%) scaleX('+ep.toFixed(3)+')';
        echoes[ei].style.opacity=(ep*(1-exit)*0.44).toFixed(3);
      }
      if(note){
        var x=-420+840*move, y=-Math.sin(move*Math.PI)*42;
        var nOp=this.smooth(0.20,0.35,prog)*(1-this.smooth(0.72,0.88,prog))*(1-exit);
        note.style.opacity=nOp.toFixed(3);
        note.style.transform='translate('+x.toFixed(1)+'px,calc(-50% + '+y.toFixed(1)+'px)) rotate('+(-22+44*move+14*Math.sin(time*4)).toFixed(1)+'deg) scale('+(0.86+0.34*flare).toFixed(3)+')';
      }
      if(trail){ trail.style.opacity=(move*(1-move)*3.4*(1-exit)).toFixed(3); trail.style.transform='translate('+(-470+840*move).toFixed(1)+'px,calc(-50% - '+(18*Math.sin(move*Math.PI)).toFixed(1)+'px)) rotate('+(6*Math.sin(move*Math.PI)).toFixed(1)+'deg)'; }
      for(var g=0; g<items.length; g++){
        var glyph=items[g];
        if(glyph.className && String(glyph.className).indexOf('tt-line-glyph')>-1){
          var gp=this.cl((prog-(glyph._delay||0)-0.34)/0.35,0,1);
          var go=Math.sin(gp*Math.PI)*(1-exit);
          glyph.style.opacity=(go*.75).toFixed(3);
          glyph.style.transform='translate('+glyph._gx.toFixed(1)+'px,'+glyph._gy.toFixed(1)+'px) scale('+(0.45+1.2*gp).toFixed(3)+')';
        }
      }
    } else if(type==='orbs'){
      // LISTEN v2
      var eo1=function(k){return 1-Math.pow(1-k,3);};
      var earOn=this.smooth(0.06,0.2,prog);
      var attend=this.smooth(0.22,0.48,prog);
      var beat=Math.pow(Math.max(0,Math.sin(time*3.1)),8);
      bg._imp=0.22*beat*attend*(1-exit);
      for(var i=0;i<items.length;i++){
        var it=items[i]; var cn=String(it.className||'');
        if(cn.indexOf('tt-listen-ear')>-1){
          var eo=earOn*(1-exit);
          it.style.opacity=(eo*.97).toFixed(3);
          it.style.transform='translate(150px,'+(5*Math.sin(time*1.3)).toFixed(1)+'px) scale('+(0.34+0.6*eo+beat*0.26*attend).toFixed(3)+')';
        } else if(cn.indexOf('tt-listen-ring')>-1){
          var lr=attend*(1-exit);
          it.style.opacity=(lr*.55).toFixed(3);
          it.style.transform='translate(150px,0) rotate('+(time*10).toFixed(1)+'deg) scale('+(0.7+0.3*lr+beat*0.14).toFixed(3)+')';
        } else if(cn.indexOf('tt-listen-arc')>-1){
          var win=this.smooth(0.08,0.18,prog)*(1-this.smooth(0.82,0.95,prog))*(1-exit);
          var k=(time*0.55+it._delay)%1;
          it.style.opacity=(Math.sin(k*Math.PI)*0.65*win).toFixed(3);
          it.style.transform='translate(-330px,0) scale('+(0.15+k*2.3).toFixed(2)+')';
        } else if(it._hit!=null){
          var kh=((time*3.1/6.283)+it._hit*0.5)%1;
          it.style.opacity=((1-kh)*(1-kh)*0.7*attend*(1-exit)).toFixed(3);
          it.style.transform='translate(150px,0) scale('+(0.12+eo1(kh)*1.9).toFixed(2)+')';
        } else if(it._flow){
          var appear=this.smooth(0.04,0.16,prog)*(1-exit);
          var kf=(time*0.30*it._spd+it._delay)%1;
          var x=-460+eo1(kf)*610;
          var calm=1-this.cl((x+130)/270,0,1)*0.9;
          var y=it._lane*32*calm+Math.sin(kf*14+it._ph)*it._amp*calm;
          var sx=1+1.6*calm*it._spd, sy=Math.max(0.5,1-0.4*calm);
          it.style.opacity=(appear*0.95*Math.sin(Math.min(kf*3,1)*Math.PI*0.5)*(kf>0.92?(1-kf)/0.08:1)).toFixed(3);
          it.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) scale('+sx.toFixed(2)+','+sy.toFixed(2)+')';
        }
      }
    } else if(type==='gather'){
      // KINDLE v2
      var eo2=function(k){return 1-Math.pow(1-k,3);};
      var pre=this.smooth(0.18,0.44,prog);
      var ign=this.smooth(0.46,0.50,prog);
      var after=this.cl((prog-0.5)/0.16,0,1);
      var glowT=Math.max(ign*0.7, after);
      var dip=this.smooth(0.38,0.455,prog)*(1-this.smooth(0.455,0.475,prog)); // held breath before ignition
      var flick=this.cl(0.35+0.5*Math.sin(time*13)+0.35*Math.sin(time*29+1.7),0,1);
      var wave=(prog-0.5)*2600;
      for(var j=0;j<items.length;j++){
        var gt=items[j], gc=String(gt.className||'');
        if(gc.indexOf('tt-kindle-core')>-1){
          var jx=Math.sin(time*42)*2.6*pre*(1-ign), jy=Math.cos(time*37)*2.2*pre*(1-ign);
          var co=(pre*0.4*flick*(1-ign)*(1-dip*0.55)+glowT*(0.88+0.12*Math.sin(time*2.6)))*(1-exit);
          gt.style.opacity=this.cl(co,0,1).toFixed(3);
          gt.style.transform='translate('+jx.toFixed(1)+'px,'+jy.toFixed(1)+'px) scale('+(0.3+pre*0.34*flick+glowT*(1.05+0.1*Math.sin(time*2.2))).toFixed(3)+')';
        } else if(gc.indexOf('tt-kindle-halo')>-1){
          gt.style.opacity=(glowT*0.78*(1-exit)).toFixed(3);
          gt.style.transform='scale('+(0.3+1.05*after+0.06*Math.sin(time*1.8)).toFixed(3)+')';
        } else if(gt._kshock){
          var ks=this.cl((prog-0.47)/0.13,0,1);
          gt.style.opacity=(Math.sin(ks*Math.PI)*0.9*(1-exit)).toFixed(3);
          gt.style.transform='scale('+(0.1+eo2(ks)*4.2).toFixed(2)+')';
        } else if(gt._burst){
          var kb=this.cl((prog-0.49-gt._delay*0.06)/0.17,0,1); var ke=eo2(kb);
          var xb2=gt._tx*ke, yb2=gt._ty*ke+46*kb*kb;
          gt.style.opacity=(kb<=0?0:(1-kb)*0.95*(1-exit)).toFixed(3);
          gt.style.transform='translate('+xb2.toFixed(1)+'px,'+yb2.toFixed(1)+'px) scale('+(1.2-0.6*kb).toFixed(2)+')';
        } else if(gt._mote){
          var pull=pre*(1-ign)*0.16 + dip*0.11;
          var lit=this.smooth(-90,50,wave-gt._dist)*this.cl(after*3,0,1);
          var push=lit*20/gt._dist;
          var fx=gt._sx*(1-pull)+gt._sx*push, fy=gt._sy*(1-pull)+gt._sy*push;
          var mdx=Math.sin(time*0.5+gt._ph)*7, mdy=Math.cos(time*0.4+gt._ph)*5;
          gt.style.opacity=((this.smooth(0.03,0.16,prog)*0.3*(1-dip*0.75)+lit*0.6)*(1-exit)).toFixed(3);
          gt.style.transform='translate('+(fx+mdx).toFixed(1)+'px,'+(fy+mdy).toFixed(1)+'px) scale('+(0.55+0.6*lit).toFixed(3)+')';
        }
      }
    } else if(type==='bloom'){
      // TOUCH -> SOUND -> BLOOM v2
      var eo3=function(k){return 1-Math.pow(1-k,3);};
      var elx=function(k){return k<=0?0:k>=1?1:Math.pow(2,-10*k)*Math.sin((k*10-0.75)*2.0944)+1;};
      var soundWin=this.smooth(0.15,0.2,prog)*(1-this.smooth(0.4,0.48,prog));
      var beat2=Math.pow(Math.abs(Math.sin(time*4.4)),3);
      var bm=this.smooth(0.44,0.62,prog);
      var glowP=Math.sin(this.cl((prog-0.58)/0.2,0,1)*Math.PI);
      for(var b=0;b<items.length;b++){
        var pe=items[b], pc=String(pe.className||'');
        if(pe._tflash){
          var tf=this.cl((prog-0.055)/0.075,0,1);
          pe.style.opacity=(Math.sin(tf*Math.PI)*0.95*(1-exit)).toFixed(3);
          pe.style.transform='scale('+(0.3+tf*1.5).toFixed(2)+')';
        } else if(pe._bshock){
          var bsK=this.cl((prog-0.06)/0.12,0,1);
          pe.style.opacity=(Math.sin(bsK*Math.PI)*0.85*(1-exit)).toFixed(3);
          pe.style.transform='scale('+(0.1+eo3(bsK)*3.6).toFixed(2)+')';
        } else if(pc.indexOf('tt-touch-ring')>-1){
          var tp=this.cl((prog-0.05-pe._delay)/0.12,0,1);
          pe.style.opacity=(Math.sin(tp*Math.PI)*0.95*(1-exit)).toFixed(3);
          pe.style.transform='scale('+(0.1+eo3(tp)*3.1).toFixed(2)+')';
        } else if(pc.indexOf('tt-sound-tick')>-1){
          var len=0.18+1.05*Math.pow(Math.abs(Math.sin(time*4.4+pe._ph)),2);
          pe.style.opacity=(soundWin*0.95*(1-exit)).toFixed(3);
          pe.style.transform='rotate('+pe._rot+'deg) translateY('+(-(50+12*beat2)).toFixed(1)+'px) scaleY('+(soundWin*len).toFixed(3)+')';
        } else if(pc.indexOf('tt-stamen')>-1){
          var stK=this.smooth(0.60+pe._st,0.72+pe._st,prog);
          pe.style.opacity=(stK*(0.65+0.35*Math.sin(time*3+pe._ph))*(1-exit)).toFixed(3);
          pe.style.transform='rotate('+pe._rot+'deg) translateY('+(-24*stK).toFixed(1)+'px) scale('+(0.3+0.7*stK).toFixed(2)+')';
        } else if(pc.indexOf('tt-petal-glint')>-1){
          var rg=pe._rot||0; var rgs=rg>180?rg-360:rg;
          var gk=this.cl((prog-0.46-pe._st)/0.26,0,1);
          var ge2=eo3(gk);
          pe.style.opacity=(gk<=0||gk>=1?0:Math.sin(gk*Math.PI)*0.95*(1-exit)).toFixed(3);
          pe.style.transform='rotate('+(rgs*ge2).toFixed(1)+'deg) translateY('+(-(16+ge2*(pe._len||130))).toFixed(1)+'px) scale('+(1.1-0.4*gk).toFixed(2)+')';
        } else if(pc.indexOf('tt-bloom-petal')>-1){
          var r=pe._rot||0; var rs=r>180?r-360:r;
          var lay=pe._layer||0;
          var pk0=this.cl((prog-0.46-pe._st-lay*0.05)/0.26,0,1);
          var grow=eo3(pk0);
          var sway=3*Math.sin(time*.9+r*0.11)*pk0;
          var shimmer=0.8+0.2*Math.sin(time*2.8+r*0.7);
          pe.style.opacity=(this.cl(pk0*2.2,0,1)*(1-exit)*shimmer*(lay?0.95:0.8)).toFixed(3);
          pe.style.transform='rotate('+(rs*grow+sway).toFixed(1)+'deg) scaleY('+(0.08+0.92*grow+0.06*glowP).toFixed(3)+') scaleX('+(0.45+0.55*grow).toFixed(3)+')';
        } else if(pc.indexOf('tt-bloom-ray')>-1){
          var ro=pe._rot||0, rayp=this.smooth(0.54,0.8,prog);
          pe.style.opacity=(rayp*(1-exit)*0.62).toFixed(3); pe.style.transform='rotate('+ro+'deg) scaleY('+(0.15+1.1*eo3(rayp)).toFixed(3)+')';
        } else if(pc.indexOf('tt-bloom-core')>-1){
          pe.style.opacity=(Math.max(bm,soundWin*0.55)*(1-exit)).toFixed(3);
          pe.style.transform='scale('+(0.5+1.5*bm+0.35*glowP+0.5*soundWin*beat2).toFixed(3)+')';
        } else if(pe._sx!=null){
          // light keeps rising from the core while the flower takes shape
          var pk=((time*0.5)+(pe._delay||0))%1;
          var vis=this.smooth(0.24,0.34,prog)*(1-this.smooth(0.78,0.9,prog));
          var xb=pe._sx+(pe._tx-pe._sx)*pk;
          var yb=pe._sy+(pe._ty-pe._sy)*eo3(pk);
          pe.style.opacity=(vis*Math.sin(pk*Math.PI)*0.8*(1-exit)).toFixed(3);
          pe.style.transform='translate('+xb.toFixed(1)+'px,'+yb.toFixed(1)+'px) scale('+(1.1-0.55*pk).toFixed(2)+')';
        }
      }
    } else if(type==='ripple'){
      // RESURFACE v3 - the story keeps spreading: rings & droplets loop on time,
      // so the motion lives on through the text HOLD (prog freezes, time does not)
      var eo4=function(k){return 1-Math.pow(1-k,3);};
      var alive=this.smooth(0.06,0.28,prog)*(1-this.smooth(0.90,1.0,prog))*(1-exit); // present once risen, gone on exit
      var swell=this.smooth(0.06,0.42,prog); // ramps the spread strength up, then holds
      for(var rr=0;rr<items.length;rr++){
        var ri=items[rr], rc=String(ri.className||'');
        if(rc.indexOf('tt-ripple-current')>-1){
          ri.style.opacity=(alive*.85).toFixed(3);
          ri.style.transform='scale('+(0.8+0.28*Math.sin(time*1.5)).toFixed(3)+')';
        } else if(rc.indexOf('tt-surface-line')>-1){
          ri.style.opacity=(alive*(0.5+0.32*Math.sin(time*3.2))).toFixed(3);
          ri.style.transform='translate(-50%,-140px) scaleX('+(0.2+0.8*swell).toFixed(3)+') scaleY('+(1+0.9*Math.pow(Math.max(0,Math.sin(time*2.2)),6)).toFixed(2)+')';
        } else if(rc.indexOf('tt-ripple-ring')>-1){
          // continuous concentric rings racing outward to the surface, staggered per ring
          var rk=((time*0.42)+(ri._delay||0)*1.1)%1;
          ri.style.opacity=(Math.sin(rk*Math.PI)*0.85*alive).toFixed(3);
          ri.style.transform='scale('+(0.3+6.4*eo4(rk)).toFixed(3)+') scaleY(0.44)';
        } else if(ri._drop){
          // droplets launch in a repeating ballistic cycle and glint at the surface line
          var kd=((time*0.5)+(ri._delay||0)+ri._st0)%1;
          var xd=ri._sx+ri._dxv*eo4(kd);
          var yd=ri._sy-ri._vyv*kd*1.6+470*kd*kd;
          var glint=Math.exp(-Math.pow((yd+140)/26,2));
          ri.style.opacity=(alive*(0.4+0.6*glint)*Math.sin(kd*Math.PI)).toFixed(3);
          ri.style.transform='translate('+xd.toFixed(1)+'px,'+yd.toFixed(1)+'px) scale('+(0.7+glint*1.7).toFixed(2)+')';
        }
      }
    } else if(type==='page'){
      // FIRST NOTE v2: gravity fall, double bounce with squash&stretch, staff strings ring on impact
      var eo5=function(k){return 1-Math.pow(1-k,3);};
      var fallK=this.cl((prog-0.26)/0.24,0,1);
      var b1=this.cl((prog-0.50)/0.06,0,1);
      var b2=this.cl((prog-0.56)/0.05,0,1);
      var land=this.smooth(0.50,0.52,prog);
      var imp=Math.exp(-Math.pow((prog-0.50)/0.014,2))+0.55*Math.exp(-Math.pow((prog-0.56)/0.011,2));
      var vib=this.smooth(0.50,0.52,prog)*(1-this.smooth(0.62,0.82,prog));
      for(var pp=0; pp<items.length; pp++){
        var el=items[pp], cc=String(el.className||'');
        if(cc.indexOf('tt-staff-line')>-1){
          var draw=this.smooth(0.05+el._idx*0.035,0.2+el._idx*0.035,prog);
          var yoff=Math.sin(time*34+el._idx*1.9)*3.6*vib*(1-el._idx*0.14);
          el.style.opacity=((draw*0.42+land*0.24+imp*0.3)*(1-exit)).toFixed(3);
          el.style.transform='translateY('+yoff.toFixed(1)+'px) scaleX('+eo5(draw).toFixed(3)+')';
        } else if(el._noteShock){
          var ns=this.cl((prog-0.50)/0.13,0,1);
          el.style.opacity=(Math.sin(ns*Math.PI)*0.9*(1-exit)).toFixed(3);
          el.style.transform='scale('+(0.1+eo5(ns)*3.4).toFixed(2)+')';
        } else if(cc.indexOf('tt-staff-note')>-1){
          var ny;
          if(fallK<1) ny=-190+214*fallK*fallK;
          else if(b1<1) ny=24-32*Math.sin(b1*Math.PI);
          else if(b2<1) ny=24-11*Math.sin(b2*Math.PI);
          else ny=24;
          var vel=fallK<1?fallK:0;
          var sxN=(1+0.55*imp)*(1-0.22*vel);
          var syN=(1-0.42*imp)*(1+0.3*vel);
          var swayN=Math.sin(fallK*8)*9*(1-fallK);
          el.style.opacity=(this.smooth(0.24,0.3,prog)*(1-exit)).toFixed(3);
          el.style.transform='translate('+swayN.toFixed(1)+'px,'+ny.toFixed(1)+'px) scale('+(sxN*(0.85+0.15*land+land*0.05*Math.sin(time*2.6))).toFixed(3)+','+(syN*(0.85+0.15*land)).toFixed(3)+')';
        } else if(cc.indexOf('tt-note-pulse')>-1){
          var pk3=(time*0.6)%1;
          el.style.opacity=(Math.sin(pk3*Math.PI)*0.55*land*(1-exit)).toFixed(3);
          el.style.transform='scale('+(0.2+pk3*2.8).toFixed(2)+')';
        } else if(el._sx!=null){
          var sk=this.cl((prog-el._delay-0.50)/0.26,0,1); var ske=eo5(sk);
          var xs=el._sx*(1-ske)+el._tx*ske, ys=(el._sy*(1-ske)+el._ty*ske)+85*sk*sk;
          el.style.opacity=(this.smooth(0.50,0.56,prog)*(1-sk*0.9)*(1-exit)).toFixed(3);
          el.style.transform='translate('+xs.toFixed(1)+'px,'+ys.toFixed(1)+'px) scale('+(1.1-0.55*sk).toFixed(3)+')';
        }
      }
    }
  }        

  startBridge(index){
    if(this._bridgeRun || this._bridgeSeen[index] || this._bridgeBypassed[index] || this._bridgeNavTarget || !this.scroller) return;
    var bg=this.bridges[index], outer=index===-1?this.transSec:bg&&(bg._bridgeOuter||bg.closest('[data-story-bridge-wrap]'));
    if(!outer) return;
    // One owner: lock native scrolling BEFORE aligning, then run animation + reading hold.
    var copy=index===-1?'':this.bridgeMobileLinesForIndex(index).map(line=>line.text||'').join('');
    var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this._reduceMotion=reduced;
    var style=this.scroller.style, saved={};
    ['overflow-y','touch-action','overscroll-behavior','scroll-behavior'].forEach(key=>{
      saved[key]=[style.getPropertyValue(key),style.getPropertyPriority(key)];
    });
    this._bridgeRun={index:index,phase:'playing',startedAt:null,duration:reduced?700:1200,
      hold:Math.min(2600,Math.max(1400,copy.trim().length*22)),saved:saved};
    if(index===-1){this._bridgeRun.duration=reduced?700:5600;this._bridgeRun.hold=reduced?1800:0;}
    outer.setAttribute('data-bridge-active','');
    style.setProperty('overflow-y','hidden','important');
    style.setProperty('touch-action','none','important');
    style.setProperty('overscroll-behavior','none','important');
    style.setProperty('scroll-behavior','auto','important');
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
    window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_PRELOAD',{detail:{chapter:['projects','members','works','news','contact'][Math.max(0,index)]}}));
  }
  // Momentum (touch flicks, trackpad inertia, a wheel smooth-scroll already in flight) can keep
  // moving the scroller after the lock engages; hold it on the bridge until the handoff takes over.
  _pinBridgeAnchor(){
    var run=this._bridgeRun;
    if(!run||run.phase==='advancing'||!this.scroller) return;
    var bg=run.index===-1?null:this.bridges[run.index];
    var outer=run.index===-1?this.transSec:bg&&(bg._bridgeOuter||(bg.closest?bg.closest('[data-story-bridge-wrap]'):null));
    if(!outer) return;
    var anchor=outer.offsetTop;
    if(Math.abs(this.scroller.scrollTop-anchor)>1){
      this.scroller.scrollTo({top:anchor,behavior:'auto'});
      this._bridgeScrollTop=this.scroller.scrollTop;
      this._sceneDirty=true;
    }
  }
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
  }
  releaseBridge(){
    var run=this._bridgeRun;
    if(!run) return;
    this._setBridgeProgress(null);
    this._bridgeRun=null;
    this._bridgeInputCutoff=performance.now();
    document.querySelectorAll('[data-bridge-active]').forEach(outer=>outer.removeAttribute('data-bridge-active'));
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
  }
  advanceBridge(now){
    var run=this._bridgeRun;
    if(!run) return;
    var targets=[['c-projects','/story-types/'],['c-members','/members/'],['c-works','/works/'],['c-news','/news/'],['c-contact','/contact/']];
    var route=targets[run.index], target=run.index===-1?this.transSec.nextElementSibling:route&&document.getElementById(route[0]);
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
  }
  bypassBridges(targetId){
    this.releaseBridge();
    this._bridgeBypassed={};
    var target=targetId&&document.getElementById(targetId), targetTop=target?target.offsetTop:(this.scroller?this.scroller.scrollTop:0);
    this._bridgeNavTarget=target&&Math.abs(this.scroller.scrollTop-targetTop)>3?targetId:null;
    if(this.transSec && this.transSec.offsetTop<targetTop) this._bridgeBypassed[-1]=true;
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
  }
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
  }
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
      if(!bg._seen&&!this._bridgeRun&&entering) this.startBridge(gi);
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
  }       

  // TRANSLATE is bridge -1: the same lock, completion record and automatic handoff.
  updateTranslation(scEl, tA){
    if(!this.transSec||!this.letters) return;
    var vh=scEl.clientHeight;
    var rectT=this.transSec.getBoundingClientRect();
    var seen=this._bridgeSeen[-1]||this._bridgeBypassed[-1], prog=seen?1:0;
    if(!seen&&!this._bridgeRun&&rectT.top<=vh*0.5&&rectT.top>=-2&&rectT.bottom>vh*0.5) this.startBridge(-1);
    var run=this._bridgeRun;
    if(run&&run.index===-1){
      this._pinBridgeAnchor();
      this._setBridgeProgress(run);
      this.transSec.setAttribute('data-bridge-active','');
      if(run.startedAt==null) run.startedAt=performance.now();
      var elapsed=performance.now()-run.startedAt;
      prog=this.cl(elapsed/run.duration,0,1);
      if(prog>=1 && run.phase==='playing'){run.phase='holding';scEl.dataset.bridgePhase='holding';}
      if(run.phase==='holding'&&elapsed>=run.duration+run.hold) this.advanceBridge(performance.now());
    }
    var motionTime=prog*7.2;
    // three acts: tale (0-.4 hold/dissolve), tone (.35-.75 bars rise), music (.62-1 full with a longer readable hold)
    var dissolve=this.smooth(0.18,0.55,prog); // letters leave
    var build=this.smooth(0.4,0.78,prog);      // bars arrive
    var full=this.smooth(0.64,0.82,prog);        // music settles
    // letters: scatter upward into particles as the tone takes over
    for(var i=0;i<this.letters.length;i++){
      var L=this.letters[i], q=this.letters.length>1?i/(this.letters.length-1):0;
      var d=this.cl((dissolve-q*0.5)*2,0,1);
      var compactTrans = window.innerWidth <= 900;
      var scatterY = compactTrans ? 38 : 70;
      var scatterWave = compactTrans ? 14 : 28;
      var scatterX = compactTrans ? 14 : 44;
      var dy=-d*scatterY - d*scatterWave*Math.sin(i*1.3);
      var dx=d*scatterX*Math.sin(i*2.1);
      L.style.opacity=(1-d).toFixed(3);
      L.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px) scale('+(1-0.25*d).toFixed(3)+')';
    }
    // bars: fill in left??몄츗ght, height pulses like a live waveform once present
    if(this.bars){
      var maxH = Math.min(this.H*0.26, 300);
      for(var b=0;b<this.bars.length;b++){
        var B=this.bars[b], bq=b/(this.bars.length-1);
        var on=this.cl((build-bq*0.6)*2.2,0,1);
        var pulse=full>0.02 ? (0.55+0.45*Math.sin(motionTime*3.2 + b*0.5)) : 1;
        var hh=6 + on*B.amp*maxH*(0.55+0.45*full)*pulse;
        B.el.style.height=hh.toFixed(1)+'px';
        B.el.style.opacity=(on*(0.5+0.5*full)).toFixed(3);
        B.el.style.background = full>0.5 ? 'var(--accent2,#3d8a98)' : 'var(--accent,#0E6E7D)';
      }
    }
    // captions cross-fade
    if(this.tcaps&&this.tcaps[0]){
      this.tcaps[0].style.opacity=(1-this.smooth(0.2,0.42,prog)).toFixed(3);
      this.tcaps[1].style.opacity=(this.smooth(0.3,0.5,prog)*(1-this.smooth(0.62,0.78,prog))).toFixed(3);
      this.tcaps[2].style.opacity=this.smooth(0.62,0.76,prog).toFixed(3);
    }
    if(this.transFoot) this.transFoot.style.opacity=full.toFixed(3);
    // hand the canvas a glint burst: strongest mid-dissolve, around the tale line
    var burst = dissolve*(1-full);
    if(burst>0.02 && this.taleLine){
      var rb=this.taleLine.getBoundingClientRect();
      this.transGlint={x:rb.left+rb.width/2, y:rb.top+rb.height/2, w:rb.width, h:rb.height, k:burst};
    } else { this.transGlint=null; }
  }

  pauseWorksAudio(){
    try{
      if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.pauseAll){ window.TALETONE_WORKS_API.pauseAll(); return; }
      document.querySelectorAll('#c-works audio,audio[data-works-audio]').forEach(function(a){ a.pause(); });
    }catch(_e){}
  }
  _defaultSeoConfig(){
    return {
      siteName: 'TALETONE MUSIC',
      baseUrl: 'https://taletone.net',
      pages: [
        { key:'home', label:'Home', path:'/', sectionId:'c-home', title:'TALETONE MUSIC — Stories become sound', description:'이야기는 소리가 됩니다. TALETONE MUSIC은 이야기를 소리와 장면으로 빚는 음악 프로덕션입니다.' },
        { key:'projects', label:'Story Types', path:'/story-types/', sectionId:'c-projects', title:'Story Types | TALETONE MUSIC', description:'TALETONE MUSIC의 세계관 프로젝트와 음악 기반 스토리텔링 작업을 소개합니다.' },
        { key:'members', label:'Members', path:'/members/', sectionId:'c-members', title:'Members | TALETONE MUSIC', description:'TALETONE MUSIC을 함께 만드는 프로듀서, 보컬, 아트 디렉터와 크리에이터 멤버들을 소개합니다.' },
        { key:'works', label:'Works', path:'/works/', sectionId:'c-works', title:'Works | TALETONE MUSIC', description:'TALETONE MUSIC이 제작하고 참여한 음악, 앨범, OST, 프로젝트 아카이브를 확인할 수 있습니다.' },
        { key:'news', label:'News', path:'/news/', sectionId:'c-news', title:'News | TALETONE MUSIC', description:'TALETONE MUSIC의 새로운 소식, 릴리즈, 프로젝트 업데이트를 전합니다.' },
        { key:'contact', label:'Contact', path:'/contact/', sectionId:'c-contact', title:'Contact | TALETONE MUSIC', description:'음악 제작, 프로젝트 협업, 스토리텔링 사운드 작업을 TALETONE MUSIC에 문의하세요.' }
      ]
    };
  }

  _normalizeSeoConfig(raw){
    var defaults = this._defaultSeoConfig();
    var cfg = raw && typeof raw === 'object' ? raw : {};
    var incoming = Array.isArray(cfg.pages) ? cfg.pages : [];
    var byKey = {};
    incoming.forEach(function(page){ if(page && page.key) byKey[String(page.key)] = page; });
    var pages = defaults.pages.map(function(def){
      var next = Object.assign({}, def, byKey[def.key] || {});
      next.key = String(next.key || def.key);
      next.label = String(next.label || def.label);
      next.path = String(next.path || def.path);
      if(next.path.charAt(0) !== '/') next.path = '/' + next.path;
      if(next.path !== '/' && next.path.slice(-1) !== '/') next.path += '/';
      next.sectionId = String(next.sectionId || def.sectionId);
      next.title = String(next.title || def.title);
      next.description = String(next.description || def.description);
      return next;
    });
    return {
      siteName: String(cfg.siteName || defaults.siteName),
      baseUrl: String(cfg.baseUrl || defaults.baseUrl).replace(/\/+$/,''),
      pages: pages
    };
  }

  _loadSeo(force){
    if(this._seoLoaded && !force) return;
    var cfg = this._normalizeSeoConfig(window.TALETONE_SEO || {});
    this.SEO_CONFIG = cfg;
    window.TALETONE_SEO = cfg;
    this._seoLoaded = true;
  }

  _seoAbsoluteUrl(path){
    this._loadSeo();
    var base = (this.SEO_CONFIG && this.SEO_CONFIG.baseUrl) || 'https://taletone.net';
    var p = path || '/';
    if(p.charAt(0) !== '/') p = '/' + p;
    return base.replace(/\/+$/,'') + p;
  }

  _seoPageKeyFromLocation(){
    var hash = String((location && location.hash) || '').replace(/^#/,'').replace(/^c-/,'').toLowerCase();
    if(hash && ['projects','members','works','news','contact'].indexOf(hash) !== -1) return hash;
    var path = String((location && location.pathname) || '/').toLowerCase().replace(/\/index\.html$/,'/');
    if(path.indexOf('/story-types/') !== -1 || path.indexOf('/projects/') !== -1) return 'projects';
    if(path.indexOf('/members/') !== -1) return 'members';
    if(path.indexOf('/works/') !== -1) return 'works';
    if(path.indexOf('/news/') !== -1) return 'news';
    if(path.indexOf('/contact/') !== -1) return 'contact';
    return 'home';
  }

  _seoPageForKey(key){
    this._loadSeo();
    var pages = (this.SEO_CONFIG && this.SEO_CONFIG.pages) || [];
    return pages.find(function(page){ return page.key === key; }) || pages[0] || this._defaultSeoConfig().pages[0];
  }

  _setMetaAttr(kind, name, value){
    var selector = 'meta[' + kind + '="' + name + '"]';
    var el = document.head && document.head.querySelector(selector);
    if(!el && document.head){
      el = document.createElement('meta');
      el.setAttribute(kind, name);
      document.head.appendChild(el);
    }
    if(el) el.setAttribute('content', value || '');
  }

  // Static <head> tags (including JSON-LD) are written per page and language by scripts/build.mjs;
  // this only keeps them in step when the route or language changes in place.
  _applySeoForCurrentPage(){
    this._loadSeo();
    var page = this._seoPageForKey(this._seoPageKeyFromLocation());
    if(!page) return;
    var lang = this.lang || this._routeLang();
    var copy = Object.assign({ title: page.title, description: page.description }, (page.translations && page.translations[lang]) || {});
    var url = this._seoAbsoluteUrl(this._langPath(page.path, lang));
    document.title = copy.title;
    this._setMetaAttr('name', 'description', copy.description);
    this._setMetaAttr('property', 'og:title', copy.title);
    this._setMetaAttr('property', 'og:description', copy.description);
    this._setMetaAttr('property', 'og:url', url);
    this._setMetaAttr('property', 'og:image:alt', copy.title);
    this._setMetaAttr('property', 'og:locale', lang === 'en' ? 'en_US' : (lang === 'jp' ? 'ja_JP' : 'ko_KR'));
    this._setMetaAttr('name', 'twitter:title', copy.title);
    this._setMetaAttr('name', 'twitter:description', copy.description);
    this._setMetaAttr('name', 'twitter:image:alt', copy.title);
    var canonical = document.head && document.head.querySelector('link[rel="canonical"]');
    if(!canonical && document.head){
      canonical = document.createElement('link');
      canonical.setAttribute('rel','canonical');
      document.head.appendChild(canonical);
    }
    if(canonical) canonical.setAttribute('href', url);
    var alternates = { ko:'kr', en:'en', ja:'jp', 'x-default':'kr' };
    for(var hreflang in alternates){
      var alt = document.head && document.head.querySelector('link[rel="alternate"][hreflang="' + hreflang + '"]');
      if(alt) alt.setAttribute('href', this._seoAbsoluteUrl(this._langPath(page.path, alternates[hreflang])));
    }
  }

  // Language lives in the URL: KR at the root, EN under /en/, JP under /ja/.
  _routeLang(){
    var m = /^\/(en|ja)(?:\/|$)/.exec(location.pathname || '/');
    return m ? (m[1] === 'ja' ? 'jp' : 'en') : 'kr';
  }

  _routePath(pathname){
    var p = String(pathname == null ? location.pathname : pathname).replace(/^\/(?:en|ja)(?=\/|$)/, '').replace(/\/index\.html$/, '/');
    return p || '/';
  }

  _langPath(path, lang){
    var l = lang || this.lang || 'kr';
    return (l === 'en' ? '/en' : (l === 'jp' ? '/ja' : '')) + (path || '/');
  }

  // Point the address bar at the current language's URL (also drops the legacy ?lang= parameter).
  _syncLangUrl(){
    try{
      var url = new URL(location.href);
      url.searchParams.delete('lang');
      url.pathname = this._langPath(this._routePath(url.pathname));
      if(url.href !== location.href) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }catch(_e){}
  }

  _localizeRouteLinks(){
    var links = document.querySelectorAll('a[href^="/"]');
    for(var i = 0; i < links.length; i++){
      var href = links[i].getAttribute('href');
      if(!/^\/(?:(?:en|ja)(?:\/|$))?(?:(?:story-types|members|works|news|contact)\/)?$/.test(href)) continue;
      var next = this._langPath(this._routePath(href));
      if(next !== href) links[i].setAttribute('href', next);
    }
  }

  applyInitialSectionFromUrl(){
    if(this._initialSectionApplied) return;
    this._loadSeo();
    var key = this._seoPageKeyFromLocation();
    if(key === 'home') return;
    var page = this._seoPageForKey(key);
    var el = page && page.sectionId ? document.getElementById(page.sectionId) : null;
    if(!el || !this.scroller) return;
    var now = performance.now();
    this.bypassBridges(page.sectionId);
    var targetTop = Math.max(0, el.offsetTop - 2);
    this.scroller.scrollTo({ top: targetTop, behavior:'auto' });
    this._initialSectionApplied = true;
    var startedAt = performance.now();
    var correctLanding = ()=>{
      if(!this.scroller || !el) return;
      var freshTop = Math.max(0, el.offsetTop - 2);
      var movedFar = Math.abs(this.scroller.scrollTop - targetTop) > Math.max(120, this.scroller.clientHeight * 0.75);
      if(movedFar || performance.now() - startedAt > 2200) return;
      var rect = el.getBoundingClientRect();
      if(Math.abs(rect.top) > 180) this.scroller.scrollTo({ top: freshTop, behavior:'auto' });
      targetTop = freshTop;
    };
    clearTimeout(this._routeLandingCorrect1);
    clearTimeout(this._routeLandingCorrect2);
    clearTimeout(this._routeLandingCorrect3);
    this._routeLandingCorrect1 = setTimeout(correctLanding, 360);
    this._routeLandingCorrect2 = setTimeout(correctLanding, 920);
    this._routeLandingCorrect3 = setTimeout(correctLanding, 1600);
    this._applySeoForCurrentPage();
  }

  async copyContactEmail(e){
    if(e && e.preventDefault) e.preventDefault();
    var contact = this.CONTACT || {};
    var email = contact.email || 'n4ml@taletone.net';
    var ok = false;
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(email);
        ok = true;
      }
    }catch(_e){}
    if(!ok){
      try{
        var ta = document.createElement('textarea');
        ta.value = email;
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
      }catch(_e2){ ok = false; }
    }
    clearTimeout(this._contactCopyTimer);
    this.setState({ contactCopyMessage: ok ? (contact.copyDone || 'Copied') : (contact.copyFail || 'Copy failed') });
    this._contactCopyTimer = setTimeout(()=>this.setState({ contactCopyMessage:'' }), 1800);
  }

  // Opening: the tale line rises, scatters into light, and resolves into the wordmark.
  scrollToId(id, behavior){
    var el=document.getElementById(id); if(!el||!this.scroller) return;
    // Chapter-nav jumps bypass bridge settlement so the chosen chapter lands directly.
    var now=performance.now();
    this.bypassBridges(id);
    var currentChapter = (document.body && document.body.getAttribute('data-active-chapter')) || '';
    var targetChapter = String(id||'').replace(/^c-/,'');
    if(currentChapter==='works' && targetChapter!=='works') this.pauseWorksAudio();
    this.scroller.scrollTo({top: el.offsetTop-2, behavior: behavior || 'smooth'});
  }

  navigateChapter(e, id, path){
    if(e && e.preventDefault) e.preventDefault();
    // Track target chapter.
    this._chapterTarget=id;
    if(path && window.history && window.history.pushState){
      try{ window.history.pushState(null, '', this._langPath(path)); }catch(_e){}
    }
    this.scrollToId(id);
    clearTimeout(this._chapterNavCorrect1);
    clearTimeout(this._chapterNavCorrect2);
    var correct = ()=>{
      var el = document.getElementById(id);
      if(!el || !this.scroller) return;
      var rect = el.getBoundingClientRect();
      if(Math.abs(rect.top) > 320) this.scrollToId(id, 'auto');
    };
    this._chapterNavCorrect1 = setTimeout(correct, 700);
    this._chapterNavCorrect2 = setTimeout(correct, 1600);
    this._applySeoForCurrentPage();
    return false;
  }

  renderVals(){
    this.ensureDataReady();
    return {
      nav0:(e)=>this.navigateChapter(e, 'c-home', '/'), nav1:(e)=>this.navigateChapter(e, 'c-translation', '/'),
      nav2:(e)=>this.navigateChapter(e, 'c-projects', '/story-types/'), nav3:(e)=>this.navigateChapter(e, 'c-members', '/members/'),
      nav4:(e)=>this.navigateChapter(e, 'c-works', '/works/'), nav5:(e)=>this.navigateChapter(e, 'c-news', '/news/'), nav6:(e)=>this.navigateChapter(e, 'c-contact', '/contact/'),
      langKR:()=>this.setLang('kr'), langEN:()=>this.setLang('en'), langJP:()=>this.setLang('jp'),
      HOME: this.HOME || {},
      TRANSLATION: this.TRANSLATION || {},
      BRIDGE_0: (this.BRIDGES||[])[0] || {},
      BRIDGE_1: (this.BRIDGES||[])[1] || {},
      BRIDGE_2: (this.BRIDGES||[])[2] || {},
      BRIDGE_3: (this.BRIDGES||[])[3] || {},
      BRIDGE_4: (this.BRIDGES||[])[4] || {},
      CHAPTER_PROLOGUE: (this.CHAPTER_LABELS||{}).prologue || {},
      CHAPTER_METHOD: (this.CHAPTER_LABELS||{}).method || { label:'PROLOGUE \u00B7 HOW WE DIVE', note:'TALE \u2192 TONE \u2192 MUSIC' },
      CHAPTER_TALE: (this.CHAPTER_LABELS||{}).tale || {},
      CHAPTER_TONE: (this.CHAPTER_LABELS||{}).tone || {},
      CHAPTER_RESURFACE: (this.CHAPTER_LABELS||{}).resurface || {},
      CHAPTER_EPILOGUE: (this.CHAPTER_LABELS||{}).epilogue || {},
      PROJECTS_META: this.PROJECTS_META || {},
      PROJECTS: this.PROJECTS || [],
      CONTACT: this.CONTACT || {},
      CONTACT_COPY_MESSAGE: this.state.contactCopyMessage || '',
      copyContactEmail:(e)=>this.copyContactEmail(e),
      TRACK_RECORD: this.TRACK_RECORD || [],
      NEWS_META: this.NEWS_META || {},
      PARTNERS_META: this.PARTNERS_META || {},
      FOOTER_META: this.FOOTER_META || {},
      UI_LABELS: this.UI_LABELS || {},
      MEMBERS_META: this.MEMBERS_META || {},
      MEMBER_CARDS: (this.MEMBERS||[]).map((m,i)=>Object.assign({}, m, {
        number: String(i + 1).padStart(2, '0'),
        open: ()=>this.openMember(i)
      })),
      mOpen: this.state.mOpen, nOpen: this.state.nOpen,
      m: (this.MEMBERS||[])[this.state.mi] || {},
      nk: (this.NEWS||[])[this.state.ni] || {},
      partnerOpen: this.state.partnerOpen,
      togglePartner:()=>this.togglePartner(),
      PARTNERS: this.PARTNERS || [],
      partnerClick: (e)=>{ var href=e.currentTarget.getAttribute('href'); if(!href || href==='#'){ if(e && e.preventDefault) e.preventDefault(); } },
      NEWS: (this.NEWS||[]).map((n,i)=>Object.assign({}, n, { open:()=>this.openNews(i) })),
      closeModal:()=>this.closeAll(),
      stop:(e)=>{ if(e&&e.stopPropagation) e.stopPropagation(); }
    };
  }
}
