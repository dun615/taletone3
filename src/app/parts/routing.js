// Routing: language switching, per-page SEO tags, language-prefixed URLs and chapter navigation.
// Methods of Component (src/app/component.js); the build attaches them with Object.assign.
var ComponentRouting = {
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
  },

  _defaultSeoConfig(){
    return {
      siteName: 'TALETONE MUSIC',
      baseUrl: 'https://taletone.net',
      pages: [
        { key:'home', label:'Home', path:'/', sectionId:'c-home', title:'TALETONE MUSIC — Stories become sound', description:'이야기는 소리가 됩니다. TALETONE MUSIC은 이야기를 소리와 장면으로 빚는 음악 프로덕션입니다.' },
        { key:'projects', label:'Story Types', path:'/story-types/', sectionId:'c-projects', title:'Story Types | TALETONE MUSIC', description:'TALETONE MUSIC의 세계관 프로젝트와 음악 기반 스토리텔링 작업을 소개합니다.' },
        { key:'members', label:'Members', path:'/members/', sectionId:'c-members', title:'Members | TALETONE MUSIC', description:'TALETONE MUSIC을 함께 만드는 프로듀서, 보컬, 아트 디렉터와 크리에이터 멤버들을 소개합니다.' },
        { key:'works', label:'Works', path:'/works/', sectionId:'c-works', title:'Works | TALETONE MUSIC', description:'TALETONE MUSIC이 제작하고 참여한 음악, 앨범, OST, 프로젝트 아카이브를 확인할 수 있습니다.' },
        { key:'contact', label:'Contact', path:'/contact/', sectionId:'c-contact', title:'Contact | TALETONE MUSIC', description:'음악 제작, 프로젝트 협업, 스토리텔링 사운드 작업을 TALETONE MUSIC에 문의하세요.' }
      ]
    };
  },

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
  },

  _loadSeo(force){
    if(this._seoLoaded && !force) return;
    var cfg = this._normalizeSeoConfig(window.TALETONE_SEO || {});
    this.SEO_CONFIG = cfg;
    window.TALETONE_SEO = cfg;
    this._seoLoaded = true;
  },

  _seoAbsoluteUrl(path){
    this._loadSeo();
    var base = (this.SEO_CONFIG && this.SEO_CONFIG.baseUrl) || 'https://taletone.net';
    var p = path || '/';
    if(p.charAt(0) !== '/') p = '/' + p;
    return base.replace(/\/+$/,'') + p;
  },

  _seoPageKeyFromLocation(){
    var hash = String((location && location.hash) || '').replace(/^#/,'').replace(/^c-/,'').toLowerCase();
    if(hash && ['projects','members','works','contact'].indexOf(hash) !== -1) return hash;
    var path = String((location && location.pathname) || '/').toLowerCase().replace(/\/index\.html$/,'/');
    if(path.indexOf('/story-types/') !== -1 || path.indexOf('/projects/') !== -1) return 'projects';
    if(path.indexOf('/members/') !== -1) return 'members';
    if(path.indexOf('/works/') !== -1) return 'works';
    if(path.indexOf('/contact/') !== -1) return 'contact';
    return 'home';
  },

  _seoPageForKey(key){
    this._loadSeo();
    var pages = (this.SEO_CONFIG && this.SEO_CONFIG.pages) || [];
    return pages.find(function(page){ return page.key === key; }) || pages[0] || this._defaultSeoConfig().pages[0];
  },

  _setMetaAttr(kind, name, value){
    var selector = 'meta[' + kind + '="' + name + '"]';
    var el = document.head && document.head.querySelector(selector);
    if(!el && document.head){
      el = document.createElement('meta');
      el.setAttribute(kind, name);
      document.head.appendChild(el);
    }
    if(el) el.setAttribute('content', value || '');
  },

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
  },

  // Language lives in the URL: KR at the root, EN under /en/, JP under /ja/.
  _routeLang(){
    var m = /^(?:\/preview)?\/(en|ja)(?:\/|$)/.exec(location.pathname || '/');
    return m ? (m[1] === 'ja' ? 'jp' : 'en') : 'kr';
  },

  _routePath(pathname){
    var p = String(pathname == null ? location.pathname : pathname).replace(/^\/preview(?=\/|$)/, '').replace(/^\/(?:en|ja)(?=\/|$)/, '').replace(/\/index\.html$/, '/');
    return p || '/';
  },

  _langPath(path, lang){
    var l = lang || this.lang || 'kr';
    // the preview keeps its own prefix, so moving through it never lands on the live site
    var preview = /^\/preview(?:\/|$)/.test(location.pathname || '') ? '/preview' : '';
    return preview + (l === 'en' ? '/en' : (l === 'jp' ? '/ja' : '')) + (path || '/');
  },

  // Point the address bar at the current language's URL (also drops the legacy ?lang= parameter).
  _syncLangUrl(){
    try{
      var url = new URL(location.href);
      url.searchParams.delete('lang');
      url.pathname = this._langPath(this._routePath(url.pathname));
      if(url.href !== location.href) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }catch(_e){}
  },

  _localizeRouteLinks(){
    var links = document.querySelectorAll('a[href^="/"]');
    for(var i = 0; i < links.length; i++){
      var href = links[i].getAttribute('href');
      if(!/^\/(?:(?:en|ja)(?:\/|$))?(?:(?:story-types|members|works|news|contact)\/)?$/.test(href)) continue;
      var next = this._langPath(this._routePath(href));
      if(next !== href) links[i].setAttribute('href', next);
    }
  },

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
  },

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
  },

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
  },
};
