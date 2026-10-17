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
    this.sections = ['c-home','c-projects','c-members','c-works','c-news','c-contact']
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
        // released on arrival, or once the jump has had time to land (a scrollbar drag sends no input events)
        if(!destination||Math.abs(current-destination.offsetTop)<=3||performance.now()-(this._bridgeNavAt||0)>1500) this._bridgeNavTarget=null;
        return;
      }
      if(current>previous+2&&this._bridgeOffsets){
        for(var bi=0;bi<this._bridgeOffsets.length;bi++){
          var bridgeTop=this._bridgeOffsets[bi];
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

    this.newsSec = document.getElementById('c-news');

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
  _normalizePartner(p,i){var src=p||{};return Object.assign({id:'p'+(i+1),name:'',role:'',image:'',link:'',brightness:100,saturation:100,lightness:100,textColor:'#ffffff'},src,{id:src.id||('p'+(i+1)),brightness:Number.isFinite(Number(src.brightness))?Number(src.brightness):100,saturation:Number.isFinite(Number(src.saturation))?Number(src.saturation):100,lightness:Number.isFinite(Number(src.lightness))?Number(src.lightness):100,textColor:src.textColor||'#ffffff',link:src.link||''});}
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
    // the dive: on the home page, once per visit (never with reduced motion)
    if(!isHomeRoute || (seen&&!forceIntro) || reduce){
      if(this.introEl) this.introEl.style.display='none';
      this.introDone=true;
      return;
    }
    this.initIntroV2();
  }

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
  }

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
    // elements inside hidden (display:none) markup have a zero box that reads as "near the viewport";
    // leave them out so nothing invisible is animated every frame
    var shown=function(el){ return el.offsetParent!==null || getComputedStyle(el).position==='fixed'; };
    ['spins','floats','floatCards','eqs','bobs','drifts'].forEach(k=>{ this[k]=this[k].filter(shown); });
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
    this.sections=['c-home','c-projects','c-members','c-works','c-news','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
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
  }
  // Depth journey: every chapter holds its own water layer (palette depth 0..1 and metres).
  // The descent to the next layer happens between a chapter's bridge and the next chapter,
  // so the sea visibly gets deeper at each handoff instead of drifting with page length.
  _buildDepthKeys(layoutHeight){
    var layers=[['c-home',0.2,0],['c-projects',0.34,200],['c-members',0.45,600],['c-works',0.6,1200],['c-news',0.7,2000],['c-contact',0.84,3200]];
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
  // utilities
  cl(v,a,b){return v<a?a:v>b?b:v;}
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
    if(pos!==this._lastScrollSampleY) this._lastScrollMoveAt=now;
    this._lastScrollSampleY=pos;
    return now;
  }
  isFastMobileScroll(now){
    return !this._bridgeRun && this.isMobileMotion() && ((now||performance.now()) < (this._fastScrollUntil||0));
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
        this.sections=['c-home','c-projects','c-members','c-works','c-news','c-contact'].map(id=>document.getElementById(id)).filter(Boolean);
      }
      var act=0, line=vh2;
      for(var k=0;k<this.sections.length;k++){
        if(this.sections[k].getBoundingClientRect().top <= line) act=k;
      }
      if(act!==this.lastActive){
        var navFor={'c-home':0,'c-projects':2,'c-members':3,'c-works':4,'c-news':5,'c-contact':6}, actNav=navFor[(this.sections[act]||{}).id];
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
    } else {
      this.drawInk(time);
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
      'home-projects': 'prologue',
      'projects-members': 'gather',
      'members-works': 'bloom',
      'works-news': 'rise',
      'news-contact': 'page'
    };
    return byId[id] || ['prologue','gather','bloom','rise','page'][i] || 'gather';
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
    try{ this._applyExternalContent(); this.forceUpdate(); this.syncContactEmailLink(); this._syncLangUrl(); this._localizeRouteLinks(); this._applySeoForCurrentPage(); if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.setMeta){ window.TALETONE_WORKS_API.setMeta((window.TALETONE_CONTENT||{}).worksMeta || this.WORKS_META || {}); } }catch(e){}
    clearTimeout(this._langRebuildTimer);
    this._langRebuildTimer=setTimeout(()=>{ try{ this.bridges = Array.from(document.querySelectorAll('[data-bridge]')); this.bridges.forEach(function(bg){ if(bg._visual && bg._visual.parentNode) bg._visual.parentNode.removeChild(bg._visual); bg._visual=null; bg._visualItems=null; bg._words=null; bg.innerHTML=''; bg.style.opacity='0'; }); this._layoutGeometryDirty=true; this._sceneDirty=true; }catch(_e){} }, 0);
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
  }                               

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
  }

  startBridge(index){
    if(this._bridgeRun || this._bridgeSeen[index] || this._bridgeBypassed[index] || this._bridgeNavTarget || !this.scroller) return;
    var bg=this.bridges[index], outer=bg&&(bg._bridgeOuter||bg.closest('[data-story-bridge-wrap]'));
    if(!outer) return;
    // One owner: lock native scrolling BEFORE aligning, then run animation + reading hold.
    var copy=this.bridgeMobileLinesForIndex(index).map(line=>line.text||'').join('');
    var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this._reduceMotion=reduced;
    var style=this.scroller.style, saved={};
    ['overflow-y','touch-action','overscroll-behavior','scroll-behavior'].forEach(key=>{
      saved[key]=[style.getPropertyValue(key),style.getPropertyPriority(key)];
    });
    this._bridgeRun={index:index,phase:'playing',startedAt:null,duration:reduced?700:1200,
      hold:Math.min(2600,Math.max(1400,copy.trim().length*22)),saved:saved};
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
    window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_PRELOAD',{detail:{chapter:['projects','members','works','news','contact'][index]}}));
  }
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
  }
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
    var email = contact.email || 'contact@taletone.net';
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
    if(!ok){
      // the copy was blocked: select the visible address so it can be copied by hand
      try{ var addr=document.querySelector('.tt-contact-address a'); if(addr){ var range=document.createRange(); range.selectNodeContents(addr); var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range); } }catch(_e3){}
    }
    this._contactCopyTimer = setTimeout(()=>this.setState({ contactCopyMessage:'' }), ok ? 1800 : 6000);
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
      nav0:(e)=>this.navigateChapter(e, 'c-home', '/'),
      nav2:(e)=>this.navigateChapter(e, 'c-projects', '/story-types/'), nav3:(e)=>this.navigateChapter(e, 'c-members', '/members/'),
      nav4:(e)=>this.navigateChapter(e, 'c-works', '/works/'), nav5:(e)=>this.navigateChapter(e, 'c-news', '/news/'), nav6:(e)=>this.navigateChapter(e, 'c-contact', '/contact/'),
      langKR:()=>this.setLang('kr'), langEN:()=>this.setLang('en'), langJP:()=>this.setLang('jp'),
      HOME: this.HOME || {},
      BRIDGE_0: (this.BRIDGES||[])[0] || {},
      BRIDGE_1: (this.BRIDGES||[])[1] || {},
      BRIDGE_2: (this.BRIDGES||[])[2] || {},
      BRIDGE_3: (this.BRIDGES||[])[3] || {},
      BRIDGE_4: (this.BRIDGES||[])[4] || {},
      CHAPTER_PROLOGUE: (this.CHAPTER_LABELS||{}).prologue || {},
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
      NEWS: (this.NEWS||[]).map((n,i)=>Object.assign({}, n, { cardImage:n.cardImage||n.image, open:()=>this.openNews(i) })),
      closeModal:()=>this.closeAll(),
      stop:(e)=>{ if(e&&e.stopPropagation) e.stopPropagation(); }
    };
  }
}
