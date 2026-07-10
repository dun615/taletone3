(function () {
  'use strict';

  var scriptUrl = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
  var assetBase = scriptUrl ? new URL('../', scriptUrl).href : 'assets/';
  var root = null;
  var works = [];
  var logos = [];
  var worksMeta = null;
  var rendering = false;
  var mounted = false;
  var renderTimer = 0;
  var dragState = { active: false, startX: 0, lastX: 0, startPosition: 0, moved: false, stage: null, step: 120 };
  var suppressClick = false;
  var pointerMoveFrame = 0;
  var queuedPointerX = 0;
  var pauseVisibilityFrame = 0;
  var galleryImageObserver = null;
  var seoHeadObserver = null;
  var seoSyncQueued = false;
  var audioPool = new Map();

  var state = {
    mode: 'showcase',
    selected: 0,
    start: 0,
    position: 0,
    track: 0,
    language: 'KR',
    playing: false,
    volume: 0.5,
    bookOpen: false,
    modalOpen: false,
    videoOpen: false
  };

  var desktopSlots = [
    { left: 13, top: '10%', rot: -6 },
    { left: 31, top: '4%', rot: 5 },
    { left: 50, top: '13%', rot: 1.5 },
    { left: 69, top: '6%', rot: 4.5 },
    { left: 87, top: '15%', rot: 7 }
  ];

  var tabletSlots = [
    { left: 17, top: '8%', rot: -5 },
    { left: 39, top: '3%', rot: 4.5 },
    { left: 62, top: '9%', rot: 1.5 },
    { left: 84, top: '5%', rot: 5.5 }
  ];

  var mobileSlots = [
    { left: 42, top: '8%', rot: -2, scale: 1.06, activeScale: 1.08 },
    { left: 64, top: '17%', rot: 5, scale: .9 },
    { left: 36, top: '17%', rot: -5, scale: .9 },
    { left: 58, top: '8%', rot: 2, scale: 1.06, activeScale: 1.08 }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function normalizeSeoPath(value) {
    var pathname = String(value || '/').split(/[?#]/)[0] || '/';
    if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
    return pathname === '/' ? '/' : pathname.replace(/\/+$/, '') + '/';
  }

  function syncStructuredData() {
    var cfg = window.TALETONE_SEO_CONTENT || window.TALETONE_SEO;
    var script = document.head && document.head.querySelector('script[type="application/ld+json"]');
    if (!cfg || !Array.isArray(cfg.pages) || !script) return;

    var currentPath = normalizeSeoPath(location.pathname);
    var page = cfg.pages.find(function (item) {
      return normalizeSeoPath(item && item.path) === currentPath;
    }) || cfg.pages[0];
    if (!page) return;

    var siteName = cfg.siteName || 'TALETONE MUSIC';
    var alternateName = Array.isArray(cfg.alternateNames) ? cfg.alternateNames : [];
    var rootUrl = new URL('/', String(cfg.baseUrl || 'https://taletone.net').replace(/\/+$/, '') + '/').href;
    var pageUrl = new URL(normalizeSeoPath(page.path), rootUrl).href;
    var schema = page.key === 'home'
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': rootUrl + '#organization',
              name: siteName,
              alternateName: alternateName,
              url: rootUrl,
              logo: new URL('/assets/icons/icon-512.png', rootUrl).href,
              description: page.description
            },
            {
              '@type': 'WebSite',
              '@id': rootUrl + '#website',
              name: siteName,
              alternateName: alternateName,
              url: rootUrl,
              publisher: { '@id': rootUrl + '#organization' }
            }
          ]
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: page.title,
          url: pageUrl,
          description: page.description,
          isPartOf: {
            '@type': 'WebSite',
            name: siteName,
            alternateName: alternateName,
            url: rootUrl
          }
        };
    var next = JSON.stringify(schema);
    if (script.textContent !== next) script.textContent = next;
  }

  function scheduleStructuredDataSync() {
    if (seoSyncQueued) return;
    seoSyncQueued = true;
    Promise.resolve().then(function () {
      seoSyncQueued = false;
      syncStructuredData();
    });
  }

  function initStructuredDataGuard() {
    syncStructuredData();
    if (!seoHeadObserver && document.head) {
      seoHeadObserver = new MutationObserver(scheduleStructuredDataSync);
      seoHeadObserver.observe(document.head, { childList: true, characterData: true, subtree: true });
      window.addEventListener('popstate', scheduleStructuredDataSync, { passive: true });
      window.addEventListener('hashchange', scheduleStructuredDataSync, { passive: true });
    }
  }

  function looksLikeRichText(value) {
    return typeof value === 'string' && /<\/?(span|strong|b|em|i|u|s|br|sub|sup|p|div)\b|&nbsp;|&#160;/i.test(value);
  }

  function cleanRichStyle(styleText) {
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
    return String(styleText || '').split(';').map(function (part) {
      var idx = part.indexOf(':');
      if (idx < 0) return '';
      var name = part.slice(0, idx).trim().toLowerCase();
      var value = part.slice(idx + 1).trim();
      if (!allowed[name]) return '';
      if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return '';
      return name + ':' + value;
    }).filter(Boolean).join(';');
  }

  function sanitizeRichHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html == null ? '' : html);
    var allowed = { SPAN: true, STRONG: true, B: true, EM: true, I: true, U: true, S: true, BR: true, SUB: true, SUP: true, P: true, DIV: true };
    function clean(parent) {
      Array.prototype.slice.call(parent.childNodes).forEach(function (node) {
        if (node.nodeType === Node.COMMENT_NODE) {
          node.remove();
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowed[node.tagName]) {
          node.replaceWith(document.createTextNode(node.textContent || ''));
          return;
        }
        Array.prototype.slice.call(node.attributes).forEach(function (attr) {
          if (attr.name.toLowerCase() === 'style') {
            var nextStyle = cleanRichStyle(attr.value);
            if (nextStyle) node.setAttribute('style', nextStyle);
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

  function plainRichText(value) {
    if (!looksLikeRichText(value)) return String(value == null ? '' : value);
    var template = document.createElement('template');
    template.innerHTML = sanitizeRichHtml(value);
    return template.content.textContent || '';
  }

  function compactLabel(value, max) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return text.slice(0, Math.max(0, max - 3)).trimEnd() + '...';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  var defaultMeta = {
    eyebrow: 'WORKS / PROJECT ARCHIVE',
    title: 'Selected',
    titleAccent: 'Works.',
    subtitle: 'A storybook of the sounds we made.',
    description: '우리가 써 내려간 소리의 이야기책.',
    collaborationLabel: 'IN COLLABORATION WITH',
    showcaseLabel: 'Showcase',
    galleryLabel: 'Gallery',
    infoKicker: 'Original Score',
    playLabel: 'Play',
    pauseLabel: 'Pause',
    creditsLabel: 'Credits',
    detailLabel: 'Works Detail',
    closeLabel: 'Close',
    yearLabel: 'Year',
    typeLabel: 'Type',
    releaseLabel: 'Release'
  };

  function pageLangKey() {
    var lang = (document.documentElement && document.documentElement.lang) || '';
    if (/^ko/i.test(lang)) return 'kr';
    if (/^ja/i.test(lang)) return 'jp';
    try {
      var saved = String(localStorage.getItem('tt_lang') || '').toLowerCase();
      if (saved === 'kr' || saved === 'en' || saved === 'jp') return saved;
    } catch (_e) {}
    return /^en/i.test(lang) ? 'en' : 'kr';
  }

  function localizedMeta() {
    var raw = worksMeta || (window.TALETONE_CONTENT && window.TALETONE_CONTENT.worksMeta) || {};
    var result = Object.assign({}, defaultMeta, raw || {});
    var translated = raw && raw.translations && raw.translations[pageLangKey()];
    if (translated && typeof translated === 'object') {
      Object.keys(translated).forEach(function (key) {
        if (translated[key] != null) result[key] = translated[key];
      });
    }
    return result;
  }

  function setMeta(meta) {
    worksMeta = meta || {};
    if (mounted) render();
  }

  function preserve(value) {
    if (looksLikeRichText(value)) return sanitizeRichHtml(value);
    return esc(value).replace(/\n/g, '<br>');
  }

  function compactRichLabel(value, max) {
    if (looksLikeRichText(value)) return sanitizeRichHtml(value);
    return esc(compactLabel(value, max));
  }

  function volumeToDb(volume) {
    if (volume <= 0) return '-inf dB';
    return (20 * Math.log10(volume)).toFixed(2) + ' dB';
  }

  function itemKind(work) {
    var kind = String(work && (work.kind || work.portfolioType || work.itemType || '') || '').toLowerCase();
    if (kind === 'multilingual' || kind === 'single_multilang' || kind === 'single-multilang') return 'single_multilang';
    if (kind === 'ep') return 'ep';
    if (kind === 'album') return 'album';
    if (work && work.tracks && work.tracks.length) return 'album';
    if (work && work.versions && work.versions.length) return 'single_multilang';
    return 'single';
  }

  function currentWork() {
    return works[clamp(state.selected, 0, Math.max(0, works.length - 1))] || null;
  }

  function titleTrackIndex(work) {
    if (!work || !work.tracks || !work.tracks.length) return 0;
    var fromData = Number(work.titleTrackIndex);
    if (Number.isFinite(fromData) && fromData >= 0 && fromData < work.tracks.length) return fromData;
    var found = work.tracks.findIndex(function (track) { return !!track.isTitle; });
    return found >= 0 ? found : 0;
  }

  function activeTrackIndex(work) {
    if (!work || !work.tracks || !work.tracks.length) return 0;
    return clamp(state.track, 0, work.tracks.length - 1);
  }

  function localizedUnit(source) {
    var result = Object.assign({}, source || {});
    var translated = source && source.translations && source.translations[pageLangKey()];
    if (translated && typeof translated === 'object') {
      Object.keys(translated).forEach(function (key) {
        if (translated[key] != null) result[key] = translated[key];
      });
    }
    return result;
  }

  function variantsFor(work, trackIndex) {
    if (!work) return [];
    var localizedWork = localizedUnit(work);
    var rawTrack = work.tracks && work.tracks.length ? work.tracks[clamp(trackIndex, 0, work.tracks.length - 1)] : null;
    var track = rawTrack ? localizedUnit(rawTrack) : null;
    if (track && track.versions && track.versions.length) return track.versions;
    if ((!track || !track.audio) && work.versions && work.versions.length) return work.versions;
    return [{
      language: 'MAIN',
      title: track && track.title ? track.title : localizedWork.title,
      date: track && track.date ? track.date : localizedWork.date,
      type: track && track.type ? track.type : localizedWork.type,
      description: track && track.description ? track.description : localizedWork.description,
      credits: track && track.credits ? track.credits : localizedWork.credits,
      image: track && track.image ? track.image : localizedWork.image,
      audio: track && track.audio ? track.audio : localizedWork.audio,
      fit: track && track.fit ? track.fit : localizedWork.fit,
      posX: track && track.posX ? track.posX : localizedWork.posX,
      posY: track && track.posY ? track.posY : localizedWork.posY,
      brightness: track && track.brightness ? track.brightness : localizedWork.brightness
    }];
  }

  function languageLabel(version, index) {
    return String(version && (version.language || version.lang || version.version) || (index === 0 ? 'KR' : 'V' + (index + 1)));
  }

  function defaultLanguage(work, trackIndex) {
    var variants = variantsFor(work, trackIndex);
    if (!variants.length) return 'KR';
    var kr = variants.find(function (version, index) { return languageLabel(version, index).toUpperCase() === 'KR'; });
    return languageLabel(kr || variants[0], variants.indexOf(kr || variants[0]));
  }

  function activeVariant(work, trackIndex) {
    var variants = variantsFor(work, trackIndex);
    if (!variants.length) return {};
    var found = variants.find(function (version, index) {
      return languageLabel(version, index) === state.language;
    });
    return found || variants[0];
  }

  function mergeDisplayUnit(work) {
    if (!work) return {};
    var trackIndex = activeTrackIndex(work);
    var localizedWork = localizedUnit(work);
    var rawTrack = work.tracks && work.tracks.length ? work.tracks[trackIndex] : null;
    var track = rawTrack ? localizedUnit(rawTrack) : null;
    var version = localizedUnit(activeVariant(work, trackIndex));
    var kind = itemKind(work);
    var coverOnly = (kind === 'album' || kind === 'ep') && !state.bookOpen;
    var source = coverOnly ? localizedWork : Object.assign({}, localizedWork, track || {}, version || {});
    return Object.assign({}, localizedWork, track || {}, version || {}, {
      title: source.title || localizedWork.title,
      date: source.date || localizedWork.date,
      type: source.type || localizedWork.type,
      description: source.description || localizedWork.description || '',
      credits: source.credits || localizedWork.credits || '',
      format: source.format || localizedWork.format || '',
      image: source.image || localizedWork.image,
      audio: (version && version.audio) || (track && track.audio) || work.audio,
      youtube: coverOnly ? (work.youtube || '') : ((version && version.youtube) || (track && track.youtube) || work.youtube || ''),
      fit: source.fit || work.fit || 'cover',
      posX: source.posX || work.posX || '50%',
      posY: source.posY || work.posY || '50%',
      brightness: source.brightness != null ? source.brightness : (localizedWork.brightness != null ? localizedWork.brightness : 1),
      responsive: source.responsive || localizedWork.responsive || null
    });
  }

  function trackLabel(work) {
    if (!work || !work.tracks || !work.tracks.length) return 'Single';
    var index = activeTrackIndex(work);
    var track = work.tracks[index];
    return 'Track ' + pad(track.trackNo || index + 1) + (index === titleTrackIndex(work) || track.isTitle ? ' (Title)' : '');
  }

  function imgTag(unit, className, defer) {
    if (!unit || !unit.image) return '<span class="' + esc(className || '') + '"></span>';
    var transparent = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    var source = defer ? transparent : unit.image;
    var deferredSource = defer ? ' data-works-src="' + esc(unit.image) + '"' : '';
    return '<img draggable="false" loading="lazy" decoding="async" class="' + esc(className || '') + '" src="' + esc(source) + '"' + deferredSource + ' alt="' + esc(plainRichText(unit.title || '')) + '" style="' + imageStyle(unit) + '">';
  }

  function numeric(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function imageStyle(unit) {
    var brightness = numeric(unit && unit.brightness, 1);
    return '--fit:' + esc((unit && unit.fit) || 'cover') + ';--pos-x:' + esc((unit && unit.posX) || '50%') + ';--pos-y:' + esc((unit && unit.posY) || '50%') + ';--brightness:' + esc(brightness);
  }

  function layoutBreakpoint() {
    var width = window.innerWidth || document.documentElement.clientWidth || 1440;
    if (width <= 720) return 'mobile';
    if (width <= 1100) return 'tablet';
    return 'desktop';
  }

  function responsiveOverride(unit) {
    var responsive = unit && unit.responsive;
    var bp = layoutBreakpoint();
    var override = responsive && (responsive[bp] || responsive.desktop);
    override = override || {};
    return {
      cardScale: numeric(override.cardScale, 1),
      titleSize: numeric(override.titleSize, 1),
      offsetX: numeric(override.offsetX, 0),
      offsetY: numeric(override.offsetY, 0)
    };
  }

  function activeSlots() {
    var width = window.innerWidth || document.documentElement.clientWidth || 1280;
    if (width <= 640) return mobileSlots;
    if (width > 640 && width <= 1180) return tabletSlots;
    return desktopSlots;
  }

  function isMobileWorksLayout() {
    var width = window.innerWidth || document.documentElement.clientWidth || 1280;
    return width <= 640;
  }

  function ensureSelectedVisible() {
    var slots = activeSlots();
    var visibleCount = Math.min(slots.length, works.length);
    var maxStart = Math.max(0, works.length - visibleCount);
    var center = Math.floor(visibleCount / 2);
    var pos = dragState.active ? numeric(state.position, state.selected) : state.selected;
    state.position = clamp(pos, 0, Math.max(0, works.length - 1));
    state.start = clamp(Math.round(state.position - center), 0, maxStart);
  }

  function resetSubState(work) {
    state.track = titleTrackIndex(work);
    state.language = defaultLanguage(work, state.track);
    state.bookOpen = false;
  }

  function currentAudioEntries() {
    var work = currentWork();
    if (!work) return [];
    var trackIndex = activeTrackIndex(work);
    return variantsFor(work, trackIndex)
      .map(function (version, index) {
        var language = languageLabel(version, index);
        var track = work.tracks && work.tracks.length ? work.tracks[trackIndex] : null;
        var audio = version.audio || (track && track.audio) || work.audio || '';
        return {
          key: [work.id || state.selected, trackIndex, language, audio].join('::'),
          audio: audio,
          language: language,
          active: language === state.language || variantsFor(work, trackIndex).length === 1
        };
      })
      .filter(function (entry) { return !!entry.audio; });
  }

  function ensureAudio(entry) {
    if (!audioPool.has(entry.key)) {
      var audio = new Audio(entry.audio);
      audio.preload = 'metadata';
      audio.loop = true; // #6 loop the track when it finishes
      audioPool.set(entry.key, audio);
    }
    return audioPool.get(entry.key);
  }

  function syncAudioState() {
    var entries = currentAudioEntries();
    var currentKeys = new Set(entries.map(function (entry) { return entry.key; }));
    audioPool.forEach(function (audio, key) {
      if (!currentKeys.has(key)) {
        audio.pause();
        return;
      }
    });
    entries.forEach(function (entry) {
      var audio = ensureAudio(entry);
      audio.volume = state.playing && entry.active ? state.volume : 0;
      if (!state.playing) audio.pause();
    });
  }

  function playCurrent() {
    var entries = currentAudioEntries();
    if (!entries.length) {
      state.playing = false;
      if (!updateShowcaseDom()) render();
      return;
    }
    state.playing = true;
    syncAudioState();
    Promise.allSettled(entries.map(function (entry) {
      return ensureAudio(entry).play();
    })).then(function () {
      syncAudioState();
      if (!updateShowcaseDom()) render();
    }).catch(function () {
      state.playing = false;
      syncAudioState();
      if (!updateShowcaseDom()) render();
    });
    if (!updateShowcaseDom()) render();
  }

  function pauseAll() {
    state.playing = false;
    audioPool.forEach(function (audio) { audio.pause(); });
    if (!updateShowcaseDom()) render();
  }

  function selectIndex(index, keepPlayback) {
    if (!works.length) return;
    var next = clamp(Number(index) || 0, 0, works.length - 1);
    var wasPlaying = state.playing && keepPlayback;
    state.selected = next;
    state.position = next;
    resetSubState(currentWork());
    ensureSelectedVisible();
    syncAudioState();
    if (wasPlaying) playCurrent();
    else if (!updateShowcaseDom()) render();
  }

  function setTrack(index) {
    var work = currentWork();
    if (!work || !work.tracks || !work.tracks.length) return;
    var wasPlaying = state.playing;
    state.track = clamp(Number(index) || 0, 0, work.tracks.length - 1);
    state.language = defaultLanguage(work, state.track);
    state.bookOpen = true;
    syncAudioState();
    if (wasPlaying) playCurrent();
    else if (!updateShowcaseDom()) render();
  }

  function setLanguage(language) {
    // #3 KR/JP both play in the background from the same playhead; switching the
    // language must ONLY flip which one is audible. Do the volume flip FIRST and
    // synchronously (zero perceived delay), then update the UI.
    state.language = String(language || 'KR');
    var entries = currentAudioEntries();
    entries.forEach(function (entry) {
      var audio = ensureAudio(entry);
      if (state.playing && entry.active) {
        // make sure the target language is actually rolling and aligned, then unmute
        var ref = null;
        entries.forEach(function (e2) { if (e2 !== entry) { var a2 = audioPool.get(e2.key); if (a2 && !a2.paused) ref = a2; } });
        if (ref && Math.abs(audio.currentTime - ref.currentTime) > 0.12) {
          try { audio.currentTime = ref.currentTime; } catch (_e) {}
        }
        if (audio.paused) { try { audio.play(); } catch (_e2) {} }
        audio.volume = state.volume;
      } else {
        audio.volume = 0;
      }
    });
    if (!updateShowcaseDom()) render();
  }

  function setMode(mode) {
    state.mode = mode === 'gallery' ? 'gallery' : 'showcase';
    state.modalOpen = false;
    render();
  }

  function go(delta) {
    selectIndex(state.selected + delta, true);
  }

  function head() {
    var meta = localizedMeta();
    return '<div class="tt-gh-head"><div class="tt-gh-kicker">' + preserve(meta.eyebrow) + '</div><h2 class="tt-gh-title">' + preserve(meta.title) + ' <span>' + preserve(meta.titleAccent) + '</span></h2><p class="tt-gh-sub">' + preserve(meta.subtitle) + '<small>' + preserve(meta.description) + '</small></p></div>';
  }

  function clients() {
    var meta = localizedMeta();
    return '<div class="tt-gh-clients"><span class="tt-gh-client-label">' + preserve(meta.collaborationLabel) + '</span><div class="tt-gh-client-pill">' + logos.map(function (logo) {
      return '<img src="' + esc(logo.src) + '" alt="' + esc(logo.alt) + '">';
    }).join('') + '</div></div>';
  }

  function worksStatus() {
    var work = currentWork();
    var unit = work ? localizedUnit(work) : null;
    var title = plainRichText((unit && unit.title) || (work && work.title) || 'WORKS');
    return '<p class="tt-gh-sr-status" aria-live="polite" aria-atomic="true">' + esc((state.selected + 1) + ' / ' + works.length + ' · ' + title) + '</p>';
  }

  function tabs() {
    var meta = localizedMeta();
    var showcaseActive = state.mode === 'showcase';
    var galleryActive = state.mode === 'gallery';
    return '<div class="tt-gh-tabs" role="tablist" aria-label="' + esc(localizedUiLabel('WORKS 보기 방식', 'WORKS view mode', 'WORKS 表示モード')) + '"><button type="button" role="tab" id="tt-gh-tab-showcase" aria-controls="tt-gh-panel-showcase" aria-selected="' + (showcaseActive ? 'true' : 'false') + '" tabindex="' + (showcaseActive ? '0' : '-1') + '" data-works-action="mode" data-mode="showcase" class="' + (showcaseActive ? 'is-active' : '') + '">' + preserve(meta.showcaseLabel) + '</button><button type="button" role="tab" id="tt-gh-tab-gallery" aria-controls="tt-gh-panel-gallery" aria-selected="' + (galleryActive ? 'true' : 'false') + '" tabindex="' + (galleryActive ? '0' : '-1') + '" data-works-action="mode" data-mode="gallery" class="' + (galleryActive ? 'is-active' : '') + '">' + preserve(meta.galleryLabel) + '</button></div>';
  }

  function controls() {
    if (works.length <= 1 || isMobileWorksLayout()) return '';
    var progress = ((state.selected + 1) / works.length) * 100;
    return '<div class="tt-gh-controls" role="group" aria-label="' + esc(localizedUiLabel('WORKS 책장 이동', 'WORKS shelf navigation', 'WORKS シェルフ移動')) + '"><button type="button" class="tt-gh-round" data-works-action="prev" aria-label="' + esc(localizedUiLabel('이전 작업물', 'Previous work', '前の作品')) + '" ' + (state.selected <= 0 ? 'disabled' : '') + '>&lsaquo;</button><div class="tt-gh-indicator" aria-hidden="true"><span class="tt-gh-page">' + pad(state.selected + 1) + ' / ' + pad(works.length) + '</span><span class="tt-gh-progress"><i style="--progress:' + progress.toFixed(2) + '%"></i></span></div><button type="button" class="tt-gh-round" data-works-action="next" aria-label="' + esc(localizedUiLabel('다음 작업물', 'Next work', '次の作品')) + '" ' + (state.selected >= works.length - 1 ? 'disabled' : '') + '>&rsaquo;</button></div>';
  }

  function visibleWorks() {
    var slots = activeSlots();
    var total = Math.min(slots.length, works.length);
    var list = [];
    for (var i = 0; i < total; i += 1) {
      var abs = state.start + i;
      if (abs < works.length) list.push({ abs: abs, slot: slots[i], item: works[abs] });
    }
    return list;
  }

  function cardPreview(work) {
    return '';
  }

  function cardUnit(work, index) {
    if (index !== state.selected) {
      var unit = localizedUnit(work);
      return Object.assign({}, unit, {
        brightness: unit && unit.brightness != null ? unit.brightness : 1,
        responsive: unit && unit.responsive ? unit.responsive : null
      });
    }
    return mergeDisplayUnit(work);
  }

  function cardTabs(work, index) {
    var variants = variantsFor(work, index === state.selected ? activeTrackIndex(work) : titleTrackIndex(work));
    if (!variants || variants.length <= 1) return '';
    return '<span class="tt-gh-card-tabs">' + variants.map(function (version, variantIndex) {
      var language = languageLabel(version, variantIndex);
      var active = index === state.selected && language === state.language;
      return '<button type="button" class="tt-gh-card-tab ' + (active ? 'is-active' : '') + '" data-works-action="card-language" data-index="' + index + '" data-language="' + esc(language) + '">' + esc(language) + '</button>';
    }).join('') + '</span>';
  }

  function albumPager(work, index) {
    var kind = itemKind(work);
    if (!work || !work.tracks || !work.tracks.length || (kind !== 'album' && kind !== 'ep')) return '';
    var selected = index === state.selected;
    var label = selected && state.bookOpen ? 'Track ' + pad(activeTrackIndex(work) + 1) : 'Cover';
    return '<span class="tt-gh-album-turn"><button type="button" data-works-action="album-prev" data-index="' + index + '" aria-label="Previous album page">&lsaquo;</button><b>' + esc(label) + '</b><button type="button" data-works-action="album-next" data-index="' + index + '" aria-label="Next album page">&rsaquo;</button></span>';
  }

  function layoutForIndex(index) {
    if (isMobileWorksLayout()) {
      var mobileOffset = index - state.selected;
      var selectedIsLast = state.selected >= works.length - 1;
      var mobileSlot = null;
      if (index === state.selected) mobileSlot = selectedIsLast ? mobileSlots[3] : mobileSlots[0];
      else if (!selectedIsLast && mobileOffset === 1) mobileSlot = mobileSlots[1];
      else if (selectedIsLast && mobileOffset === -1) mobileSlot = mobileSlots[2];
      if (mobileSlot) {
        return {
          visible: true,
          left: mobileSlot.left,
          top: mobileSlot.top,
          rot: mobileSlot.rot,
          scale: mobileOffset === 0 ? (mobileSlot.activeScale || 1.08) : (mobileSlot.scale || .9),
          z: mobileOffset === 0 ? 9 : 5 - Math.abs(mobileOffset),
          delay: (index % mobileSlots.length) * -0.8
        };
      }
      return {
        visible: false,
        left: mobileOffset < 0 ? -18 : 118,
        top: '18%',
        rot: mobileOffset < 0 ? -8 : 8,
        scale: .76,
        z: 0,
        delay: (index % mobileSlots.length) * -0.8
      };
    }

    var slots = activeSlots();
    var visibleCount = Math.min(slots.length, works.length);
    var maxStart = Math.max(0, works.length - visibleCount);
    var center = Math.floor(visibleCount / 2);
    var pos = clamp(numeric(state.position, state.selected), 0, Math.max(0, works.length - 1));
    var rawStart = pos - center;
    var start = clamp(rawStart, 0, maxStart);
    if (dragState.active && rawStart < 0) start = rawStart * 0.34;
    if (dragState.active && rawStart > maxStart) start = maxStart + (rawStart - maxStart) * 0.34;
    var offset = index - start;
    return fluidLayout(index, offset, pos, slots);
  }

  function topNumber(slot) {
    return numeric(String(slot && slot.top || '12%').replace('%', ''), 12);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function slotValue(slot, key, fallback) {
    return numeric(slot && slot[key], fallback);
  }

  function virtualSlot(slots, side) {
    var first = slots[0] || { left: 0, top: '12%', rot: -7, scale: .86 };
    var last = slots[slots.length - 1] || { left: 100, top: '12%', rot: 7, scale: .86 };
    if (side < 0) {
      var second = slots[1] || first;
      return {
        left: first.left - Math.max(16, second.left - first.left),
        top: first.top,
        rot: first.rot - 4,
        scale: .82,
        activeScale: .9
      };
    }
    var beforeLast = slots[slots.length - 2] || last;
    return {
      left: last.left + Math.max(16, last.left - beforeLast.left),
      top: last.top,
      rot: last.rot + 4,
      scale: .82,
      activeScale: .9
    };
  }

  function mixedSlot(slots, offset) {
    var lastIndex = slots.length - 1;
    var a;
    var b;
    var t;
    if (offset < 0) {
      a = virtualSlot(slots, -1);
      b = slots[0];
      t = clamp(offset + 1, 0, 1);
    } else if (offset > lastIndex) {
      a = slots[lastIndex];
      b = virtualSlot(slots, 1);
      t = clamp(offset - lastIndex, 0, 1);
    } else {
      var lo = Math.floor(offset);
      var hi = Math.min(lastIndex, lo + 1);
      a = slots[lo];
      b = slots[hi];
      t = offset - lo;
    }
    return {
      left: lerp(slotValue(a, 'left', 50), slotValue(b, 'left', 50), t),
      top: lerp(topNumber(a), topNumber(b), t),
      rot: lerp(slotValue(a, 'rot', 0), slotValue(b, 'rot', 0), t),
      scale: lerp(slotValue(a, 'scale', 1), slotValue(b, 'scale', 1), t),
      activeScale: lerp(slotValue(a, 'activeScale', 1.06), slotValue(b, 'activeScale', 1.06), t)
    };
  }

  function fluidLayout(index, offset, pos, slots) {
    var slot = mixedSlot(slots, offset);
    var last = slots.length - 1;
    var focus = clamp(1 - Math.abs(index - pos), 0, 1);
    var visible = offset > -1.02 && offset < last + 1.02;
    var leftFade = clamp((offset + 1.02) / 0.34, 0, 1);
    var rightFade = clamp((last + 1.02 - offset) / 0.34, 0, 1);
    var opacity = visible ? leftFade * rightFade : 0;
    return {
      visible: visible && opacity > 0.01,
      opacity: opacity,
      left: Number(slot.left.toFixed(3)),
      top: slot.top.toFixed(3) + '%',
      rot: Number(slot.rot.toFixed(3)),
      scale: Number((slot.scale + (slot.activeScale - slot.scale) * focus).toFixed(4)),
      z: Math.round(100 - Math.abs(index - pos) * 12),
      delay: (index % slots.length) * -0.8
    };
  }

  function cardStyle(layout, unit) {
    var res = responsiveOverride(unit);
    var opacity = layout.opacity != null ? layout.opacity : (layout.visible ? 1 : 0);
    return '--left:' + layout.left + '%;--top:' + layout.top + ';--rot:' + layout.rot + 'deg;--scale:' + layout.scale + ';--z:' + layout.z + ';--opacity:' + opacity.toFixed(3) + ';--float-delay:' + layout.delay + 's;--card-scale-override:' + res.cardScale + ';--title-scale:' + res.titleSize + ';--offset-x:' + res.offsetX + 'px;--offset-y:' + res.offsetY + 'px';
  }

  function cardPlay(work, index, unit) {
    var yt = (unit && unit.youtube) || '';
    if (!yt) return '';
    return '<button type="button" class="tt-gh-card-play" data-works-action="video-open" data-index="' + index + '" aria-label="Watch on YouTube"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>';
  }

  function showcase() {
    var cards = works.map(function (work, index) {
      var layout = layoutForIndex(index);
      var active = index === state.selected;
      var unit = cardUnit(work, index);
      var cardLabel = (index + 1) + ' / ' + works.length + ' · ' + plainRichText(unit.title || work.title || 'WORKS');
      return '<div role="button" tabindex="0" aria-label="' + esc(cardLabel) + '" ' + (active ? 'aria-current="true" ' : '') + 'class="tt-gh-card ' + (active ? 'is-active ' : '') + (layout.visible ? 'is-visible' : 'is-hidden') + '" data-works-card data-works-action="select" data-index="' + index + '" style="' + cardStyle(layout, unit) + '"><span class="tt-gh-pin"></span><span class="tt-gh-card-inner"><span class="tt-gh-card-cover">' + imgTag(unit, '', !layout.visible) + cardPlay(work, index, unit) + cardTabs(work, index) + albumPager(work, index) + '</span><span class="tt-gh-card-meta"><span class="tt-gh-card-title">' + compactRichLabel(unit.title || work.title, 18) + '</span><span class="tt-gh-card-type">' + compactRichLabel(unit.type || work.type || itemKind(work), 20) + '</span></span></span>' + cardPreview(work) + '</div>';
    }).join('');
    return '<div id="tt-gh-panel-showcase" class="tt-gh-stage" role="tabpanel" aria-labelledby="tt-gh-tab-showcase" aria-roledescription="carousel" aria-label="' + esc(localizedUiLabel('WORKS 포트폴리오 책장', 'WORKS portfolio shelf', 'WORKS ポートフォリオシェルフ')) + '" tabindex="0" data-works-drag-stage><div class="tt-gh-waves"><i class="tt-gh-line"></i><i class="tt-gh-line"></i><i class="tt-gh-line"></i><i class="tt-gh-line"></i></div><div class="tt-gh-showcase" data-works-drag-track>' + cards + '</div>' + controls() + '</div>';
  }

  function videoLightbox() {
    if (!state.videoOpen) return '';
    var work = currentWork();
    if (!work) return '';
    var unit = mergeDisplayUnit(work);
    var meta = localizedMeta();
    return '<div class="tt-gh-modal tt-gh-video-modal" role="dialog" aria-modal="true" aria-label="' + esc(plainRichText(unit.title || work.title || 'WORKS')) + ' video" tabindex="-1"><button type="button" class="tt-gh-modal-backdrop" data-works-action="video-close" aria-label="' + esc(plainRichText(meta.closeLabel || 'Close')) + ' video"></button><section class="tt-gh-modal-panel tt-gh-video-panel" role="document"><button type="button" class="tt-gh-modal-close" data-works-action="video-close">' + preserve(meta.closeLabel) + '</button><div class="tt-gh-modal-video">' + modalVideo(unit) + '</div></section></div>';
  }

  function segments() {
    return '<div class="tt-gh-segments" style="--count:' + works.length + '">' + works.map(function (_work, index) {
      return '<button type="button" class="' + (index === state.selected ? 'is-active' : '') + '" data-works-action="select" data-index="' + index + '" aria-label="Select work ' + (index + 1) + '"></button>';
    }).join('') + '</div>';
  }

  function gallery() {
    return '<div id="tt-gh-panel-gallery" class="tt-gh-gallery" role="tabpanel" aria-labelledby="tt-gh-tab-gallery">' + works.map(function (work, index) {
      var unit = localizedUnit(work);
      var detailLabel = plainRichText(unit.title || 'WORKS') + localizedUiLabel(' 상세', ' details', ' 詳細');
      return '<div role="button" tabindex="0" aria-haspopup="dialog" aria-label="' + esc(detailLabel) + '" class="tt-gh-gallery-card" data-works-action="gallery-open" data-index="' + index + '"><span class="tt-gh-card-inner"><span class="tt-gh-card-cover">' + imgTag(unit, '', true) + cardTabs(work, index) + albumPager(work, index) + '</span><span class="tt-gh-card-meta"><span class="tt-gh-card-title">' + compactRichLabel(unit.title, 18) + '</span><span class="tt-gh-card-type">' + compactRichLabel(unit.type || itemKind(work), 20) + '</span></span></span></div>';
    }).join('') + '</div>';
  }

  function languageButtons(work) {
    var variants = variantsFor(work, activeTrackIndex(work));
    if (variants.length <= 1) return '';
    return '<div class="tt-gh-row">' + variants.map(function (version, index) {
      var language = languageLabel(version, index);
      return '<button type="button" class="tt-gh-select ' + (language === state.language ? 'is-active' : '') + '" data-works-action="language" data-language="' + esc(language) + '">' + esc(language) + '</button>';
    }).join('') + '</div>';
  }

  function trackButtons(work) {
    var kind = itemKind(work);
    if (!work || !work.tracks || !work.tracks.length || (kind !== 'album' && kind !== 'ep')) return '';
    return '<div class="tt-gh-row"><button type="button" class="tt-gh-select ' + (!state.bookOpen ? 'is-active' : '') + '" data-works-action="cover">Cover</button>' + work.tracks.map(function (track, index) {
      return '<button type="button" class="tt-gh-select ' + (index === activeTrackIndex(work) ? 'is-active' : '') + '" data-works-action="track" data-index="' + index + '">Track ' + pad(track.trackNo || index + 1) + (index === titleTrackIndex(work) || track.isTitle ? ' (Title)' : '') + '</button>';
    }).join('') + '</div>';
  }

  function youtubeEmbedUrl(value) {
    var url = String(value || '');
    if (!url) return '';
    var match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return match ? 'https://www.youtube.com/embed/' + match[1] + '?rel=0' : '';
  }

  function videoField(unit) {
    return unit.youtube || unit.youtubeUrl || unit.video || unit.videoUrl || '';
  }

  function modalVideo(unit) {
    var embed = youtubeEmbedUrl(videoField(unit));
    if (embed) return '<iframe title="' + esc(plainRichText(unit.title || 'WORKS video')) + '" src="' + esc(embed) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    return '<div class="tt-gh-modal-empty"><b>' + preserve(unit.title || 'WORKS') + '</b><span>No YouTube link in this data.</span></div>';
  }

  function detailTable(work, unit, kind, format) {
    var meta = localizedMeta();
    return '<dl class="tt-gh-info-table"><div><dt>' + preserve(meta.yearLabel) + '</dt><dd>' + preserve(unit.date || work.date || '-') + '</dd></div><div><dt>' + preserve(meta.typeLabel) + '</dt><dd>' + preserve(unit.format || format) + '</dd></div><div><dt>' + preserve(meta.releaseLabel) + '</dt><dd>' + preserve(unit.type || work.type || kind) + '</dd></div></dl>';
  }

  function creditsText(work, unit) {
    return String(unit.credits || work.credits || 'Credits not available.');
  }

  function infoPanel() {
    var work = currentWork();
    if (!work) return '';
    var unit = mergeDisplayUnit(work);
    var kind = itemKind(work);
    var entries = currentAudioEntries();
    var hasAudio = entries.length > 0;
    var format = [kind, trackLabel(work), state.language].filter(Boolean).join(' / ');
    var controls = trackButtons(work) + languageButtons(work);
    var videoBlock = '';
    var meta = localizedMeta();
    return '<section class="tt-gh-info"><div class="tt-gh-info-copy"><span class="tt-gh-info-kicker"><i></i> ' + preserve(meta.infoKicker) + '</span><h3>' + preserve(unit.title || work.title) + '</h3><p style="white-space:pre-wrap">' + preserve(unit.description || work.description || unit.credits || work.credits || 'TALETONE MUSIC archive.') + '</p><div class="tt-gh-actions-line"><button type="button" class="tt-gh-action is-primary" data-works-action="play" ' + (hasAudio ? '' : 'disabled') + '>' + preserve(state.playing ? meta.pauseLabel : meta.playLabel) + '</button><input class="tt-gh-volume" type="range" min="0" max="1" step="0.01" value="' + state.volume + '" data-works-action="volume" aria-label="WORKS volume"><span class="tt-gh-db" data-works-db>' + volumeToDb(state.volume) + '</span></div></div><span class="tt-gh-info-rule"></span>' + videoBlock + detailTable(work, unit, kind, format) + (controls ? '<div class="tt-gh-side">' + controls + '</div>' : '') + '</section>';
  }

  function galleryModal() {
    if (state.mode !== 'gallery' || !state.modalOpen) return '';
    var work = currentWork();
    if (!work) return '';
    var unit = mergeDisplayUnit(work);
    var kind = itemKind(work);
    var format = [kind, trackLabel(work), state.language].filter(Boolean).join(' / ');
    var controls = trackButtons(work) + languageButtons(work);
    var meta = localizedMeta();
    return '<div class="tt-gh-modal" role="dialog" aria-modal="true" aria-label="' + esc(plainRichText(unit.title || work.title || 'WORKS')) + ' detail" tabindex="-1"><button type="button" class="tt-gh-modal-backdrop" data-works-action="modal-close" aria-label="' + esc(plainRichText(meta.closeLabel || 'Close')) + ' detail"></button><section class="tt-gh-modal-panel" role="document"><button type="button" class="tt-gh-modal-close" data-works-action="modal-close">' + preserve(meta.closeLabel) + '</button><div class="tt-gh-modal-main"><div class="tt-gh-modal-video">' + modalVideo(unit) + '</div><div class="tt-gh-modal-copy"><span class="tt-gh-info-kicker"><i></i> ' + preserve(meta.detailLabel) + '</span><h3>' + preserve(unit.title || work.title) + '</h3><p style="white-space:pre-wrap">' + preserve(unit.description || work.description || 'TALETONE MUSIC archive.') + '</p>' + detailTable(work, unit, kind, format) + (controls ? '<div class="tt-gh-side">' + controls + '</div>' : '') + '</div></div><aside class="tt-gh-modal-credits"><span class="tt-gh-info-kicker"><i></i> ' + preserve(meta.creditsLabel) + '</span><pre>' + preserve(creditsText(work, unit)) + '</pre></aside></section></div>';
  }

  function syncModalBodyClass() {
    document.body.classList.toggle('tt-works-modal-open', !!(state.modalOpen || state.videoOpen));
  }

  function blockFollowupClick(ms) {
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, ms || 260);
  }

  function loadDeferredImage(image) {
    if (!image || !image.dataset || !image.dataset.worksSrc) return;
    image.src = image.dataset.worksSrc;
    image.removeAttribute('data-works-src');
  }

  function bindLazyGalleryImages() {
    if (galleryImageObserver) {
      galleryImageObserver.disconnect();
      galleryImageObserver = null;
    }
    if (!root || state.mode !== 'gallery') return;
    var deferred = root.querySelectorAll('.tt-gh-gallery img[data-works-src]');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(deferred, loadDeferredImage);
      return;
    }
    galleryImageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadDeferredImage(entry.target);
        galleryImageObserver.unobserve(entry.target);
      });
    }, { root: null, rootMargin: '260px 0px', threshold: 0.01 });
    Array.prototype.forEach.call(deferred, function (image) { galleryImageObserver.observe(image); });
  }

  function render() {
    root = ensureRoot();
    if (!root || !works.length) return;
    rendering = true;
    ensureSelectedVisible();
    preloadNearbyImages(state.selected);
    root.innerHTML = '<div class="tt-gh-shell">' + worksStatus() + head() + clients() + tabs() + (state.mode === 'gallery' ? gallery() : showcase()) + (state.mode === 'showcase' ? infoPanel() : '') + galleryModal() + videoLightbox() + '</div>';
    bindLazyGalleryImages();
    syncModalBodyClass();
    bindModalCloseHandlers();
    mounted = true;
    rendering = false;
    syncAudioState();
  }

  function bindModalCloseHandlers() {
    if (!root) return;
    root.querySelectorAll('[data-works-action="video-close"]').forEach(function (node) {
      node.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        blockFollowupClick(320);
        state.videoOpen = false;
        render();
      };
      node.onpointerdown = node.onclick;
    });
    root.querySelectorAll('[data-works-action="modal-close"]').forEach(function (node) {
      node.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        blockFollowupClick(320);
        state.modalOpen = false;
        render();
      };
      node.onpointerdown = node.onclick;
    });
  }

  function updateShowcaseDom(layoutOnly) {
    if (!root || state.mode !== 'showcase') return false;
    var stage = root.querySelector('[data-works-drag-stage]');
    if (!stage) return false;
    root.querySelectorAll('[data-works-card]').forEach(function (card) {
      var index = Number(card.getAttribute('data-index')) || 0;
      var layout = layoutForIndex(index);
      card.classList.toggle('is-active', index === state.selected);
      card.classList.toggle('is-visible', layout.visible);
      card.classList.toggle('is-hidden', !layout.visible);
      if (index === state.selected) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
      var work = works[index];
      var unit = cardUnit(work, index);
      card.setAttribute('aria-label', (index + 1) + ' / ' + works.length + ' · ' + plainRichText((unit && unit.title) || (work && work.title) || 'WORKS'));
      card.setAttribute('style', cardStyle(layout, unit));
      if (layoutOnly) return;
      var img = card.querySelector('.tt-gh-card-cover img');
      if (img && unit && unit.image && layout.visible) {
        if (img.getAttribute('src') !== unit.image) img.setAttribute('src', unit.image);
        img.removeAttribute('data-works-src');
        img.setAttribute('alt', unit.title || '');
        img.setAttribute('style', imageStyle(unit));
      }
      var title = card.querySelector('.tt-gh-card-title');
      if (title) title.innerHTML = compactRichLabel(unit.title || (work && work.title) || '', 18);
      var type = card.querySelector('.tt-gh-card-type');
      if (type) type.innerHTML = compactRichLabel(unit.type || (work && work.type) || itemKind(work), 20);
      card.querySelectorAll('.tt-gh-card-tab').forEach(function (tabButton) {
        tabButton.classList.toggle('is-active', index === state.selected && tabButton.getAttribute('data-language') === state.language);
      });
      var albumLabel = card.querySelector('.tt-gh-album-turn b');
      if (albumLabel && work && work.tracks && work.tracks.length) {
        albumLabel.textContent = index === state.selected && state.bookOpen ? 'Track ' + pad(activeTrackIndex(work) + 1) : 'Cover';
      }
      // Keep the center YouTube play button in sync for every card that has a link.
      var cover = card.querySelector('.tt-gh-card-cover');
      var existingPlay = cover ? cover.querySelector('.tt-gh-card-play') : null;
      var wantPlay = unit && unit.youtube;
      if (cover) {
        if (wantPlay && !existingPlay) {
          cover.insertAdjacentHTML('beforeend', '<button type="button" class="tt-gh-card-play" data-works-action="video-open" data-index="' + index + '" aria-label="Watch on YouTube"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>');
        } else if (!wantPlay && existingPlay) {
          existingPlay.remove();
        } else if (existingPlay) {
          existingPlay.setAttribute('data-index', String(index));
        }
      }
    });
    if (layoutOnly) return true;
    var statusNode = root.querySelector('.tt-gh-sr-status');
    if (statusNode) {
      var statusWork = currentWork();
      var statusUnit = statusWork ? localizedUnit(statusWork) : null;
      statusNode.textContent = (state.selected + 1) + ' / ' + works.length + ' · ' + plainRichText((statusUnit && statusUnit.title) || (statusWork && statusWork.title) || 'WORKS');
    }
    var controlsNode = root.querySelector('.tt-gh-controls');
    var controlsHtml = controls();
    if (controlsNode) controlsNode.outerHTML = controlsHtml;
    else if (controlsHtml) stage.insertAdjacentHTML('beforeend', controlsHtml);
    var infoNode = root.querySelector('.tt-gh-info');
    if (infoNode) infoNode.outerHTML = infoPanel();
    syncAudioState();
    return true;
  }

  function onClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-works-action]') : null;
    var section = document.getElementById('c-works');
    if (!button || !section || !section.contains(button)) return;
    var action = button.getAttribute('data-works-action');
    if (action === 'mode') {
      state.videoOpen = false;
      state.modalOpen = false;
      setMode(button.getAttribute('data-mode'));
      return;
    }
    if (action === 'video-open') {
      if (suppressClick) return;
      rememberDialogTrigger(button);
      var videoIndex = button.hasAttribute('data-index') ? Number(button.getAttribute('data-index')) : state.selected;
      if (Number.isFinite(videoIndex)) {
        if (videoIndex !== state.selected) {
          selectIndex(videoIndex, true);
          return;
        }
        state.selected = clamp(videoIndex, 0, works.length - 1);
        state.position = state.selected;
        resetSubState(currentWork());
        ensureSelectedVisible();
      }
      state.videoOpen = true;
      render();
      return;
    }
    if (action === 'video-close') {
      event.preventDefault();
      event.stopPropagation();
      blockFollowupClick(320);
      state.videoOpen = false;
      render();
      return;
    }
    if (action === 'prev' && state.selected > 0) go(-1);
    if (action === 'next' && state.selected < works.length - 1) go(1);
    if (action === 'select') {
      if (suppressClick) return;
      selectIndex(Number(button.getAttribute('data-index')), true);
      return;
    }
    if (action === 'gallery-open') {
      if (suppressClick) return;
      rememberDialogTrigger(button);
      state.selected = clamp(Number(button.getAttribute('data-index')) || 0, 0, works.length - 1);
      resetSubState(currentWork());
      state.modalOpen = true;
      syncAudioState();
      render();
      return;
    }
    if (action === 'modal-close') {
      event.preventDefault();
      event.stopPropagation();
      blockFollowupClick(320);
      state.modalOpen = false;
      render();
      return;
    }
    if (action === 'card-language') {
      if (suppressClick) return;
      state.selected = clamp(Number(button.getAttribute('data-index')) || 0, 0, works.length - 1);
      state.language = String(button.getAttribute('data-language') || 'KR');
      state.bookOpen = false;
      if (state.mode === 'gallery') state.modalOpen = true;
      ensureSelectedVisible();
      syncAudioState();
      if (state.mode === 'gallery') render(); else if (!updateShowcaseDom()) render();
      return;
    }
    if (action === 'cover') {
      state.bookOpen = false;
      if (!updateShowcaseDom()) render();
      syncAudioState();
      return;
    }
    if (action === 'album-next' || action === 'album-prev') {
      if (suppressClick) return;
      var albumWasPlaying = state.playing;
      var albumIndex = clamp(Number(button.getAttribute('data-index')) || 0, 0, works.length - 1);
      state.selected = albumIndex;
      var albumWork = currentWork();
      if (albumWork && albumWork.tracks && albumWork.tracks.length) {
        if (action === 'album-next') {
          if (!state.bookOpen) {
            state.bookOpen = true;
            state.track = 0;
          } else {
            state.track = clamp(state.track + 1, 0, albumWork.tracks.length - 1);
          }
        } else if (!state.bookOpen || state.track <= 0) {
          state.bookOpen = false;
          state.track = titleTrackIndex(albumWork);
        } else {
          state.track = clamp(state.track - 1, 0, albumWork.tracks.length - 1);
        }
        state.language = defaultLanguage(albumWork, state.track);
      }
      if (state.mode === 'gallery') state.modalOpen = true;
      ensureSelectedVisible();
      if (albumWasPlaying) playCurrent(); else syncAudioState();
      if (state.mode === 'gallery') render(); else if (!updateShowcaseDom()) render();
      return;
    }
    if (action === 'track') { setTrack(Number(button.getAttribute('data-index'))); return; }
    if (action === 'language') { setLanguage(button.getAttribute('data-language')); return; }
    if (action === 'book') {
      state.bookOpen = !state.bookOpen;
      render();
      return;
    }
    if (action === 'play') {
      if (state.playing) pauseAll();
      else playCurrent();
    }
  }

  function onInput(event) {
    var input = event.target && event.target.closest ? event.target.closest('[data-works-action="volume"]') : null;
    var section = document.getElementById('c-works');
    if (!input || !section || !section.contains(input)) return;
    state.volume = clamp(Number(input.value), 0, 1);
    var label = section.querySelector('[data-works-db]');
    if (label) label.textContent = volumeToDb(state.volume);
    syncAudioState();
  }

  function onKey(event) {
    var volumeInput = event.target && event.target.closest ? event.target.closest('[data-works-action="volume"]') : null;
    if (volumeInput && ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].indexOf(event.key) !== -1) {
      event.preventDefault();
      var step = numeric(volumeInput.step, 0.01);
      if (event.key === 'Home') state.volume = 0;
      else if (event.key === 'End') state.volume = 1;
      else state.volume = clamp(state.volume + ((event.key === 'ArrowRight' || event.key === 'ArrowUp') ? step : -step), 0, 1);
      volumeInput.value = String(state.volume);
      var volumeLabel = document.querySelector('[data-works-db]');
      if (volumeLabel) volumeLabel.textContent = volumeToDb(state.volume);
      syncAudioState();
      return;
    }
    var actionable = event.target && event.target.closest ? event.target.closest('[role="button"][data-works-action]') : null;
    if (actionable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      actionable.click();
      return;
    }
    var modeTab = event.target && event.target.closest ? event.target.closest('.tt-gh-tabs [role="tab"]') : null;
    if (modeTab && (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      var nextMode = (event.key === 'ArrowLeft' || event.key === 'Home') ? 'showcase' : 'gallery';
      setMode(nextMode);
      var nextTab = document.getElementById('tt-gh-tab-' + nextMode);
      if (nextTab) nextTab.focus({ preventScroll: true });
      return;
    }
    var section = document.getElementById('c-works');
    if (!section || !isSectionVisible(section)) return;
    var stage = event.target && event.target.closest ? event.target.closest('[data-works-drag-stage]') : null;
    var card = event.target && event.target.closest ? event.target.closest('[data-works-card]') : null;
    var shelfKeyboardTarget = event.target === document.body || event.target === stage || event.target === card;
    if (event.key === 'ArrowLeft') {
      if (!shelfKeyboardTarget) return;
      event.preventDefault();
      go(-1);
    }
    if (event.key === 'ArrowRight') {
      if (!shelfKeyboardTarget) return;
      event.preventDefault();
      go(1);
    }
    if (event.key === 'Home' && shelfKeyboardTarget) {
      event.preventDefault();
      selectIndex(0, true);
    }
    if (event.key === 'End' && shelfKeyboardTarget) {
      event.preventDefault();
      selectIndex(works.length - 1, true);
    }
    if (event.key === ' ' && event.target === document.body) {
      event.preventDefault();
      if (state.playing) pauseAll();
      else playCurrent();
    }
  }

  function onWheel(event) {
    return;
  }

  function shelfNodeFromTarget(target) {
    var node = target && target.nodeType === 1 ? target : target && target.parentElement;
    if (!node || !node.closest) return null;
    var section = document.getElementById('c-works');
    var stage = node.closest('[data-works-drag-stage]');
    if (!section || !stage || !section.contains(stage)) return null;
    return stage;
  }

  function onNativeDragStart(event) {
    if (!shelfNodeFromTarget(event.target)) return;
    event.preventDefault();
  }

  function onNativeSelectStart(event) {
    if (!shelfNodeFromTarget(event.target)) return;
    event.preventDefault();
  }

  function onPointerDown(event) {
    if (dragState.active) return;
    var actionButton = event.target && event.target.closest ? event.target.closest('[data-works-action]') : null;
    var action = actionButton ? actionButton.getAttribute('data-works-action') : '';
    if (action === 'video-close' || action === 'modal-close') {
      event.preventDefault();
      event.stopPropagation();
      blockFollowupClick(320);
      if (action === 'video-close') state.videoOpen = false;
      if (action === 'modal-close') state.modalOpen = false;
      render();
      return;
    }
    var section = document.getElementById('c-works');
    if (!section || !section.contains(event.target)) return;
    var stage = event.target && event.target.closest ? event.target.closest('[data-works-drag-stage]') : null;
    if (!stage || !section.contains(stage)) return;
    if (event.target.closest('[data-works-action="prev"],[data-works-action="next"],.tt-gh-tabs,.tt-gh-segments,.tt-gh-info,.tt-gh-modal,input')) return;
    if (event.cancelable) event.preventDefault();
    dragState.active = true;
    dragState.startX = event.clientX;
    dragState.lastX = event.clientX;
    dragState.startPosition = clamp(numeric(state.position, state.selected), 0, Math.max(0, works.length - 1));
    dragState.moved = false;
    dragState.stage = stage;
    dragState.step = Math.max(100, Math.min(160, stage.getBoundingClientRect().width * 0.115));
    stage.classList.add('is-dragging');
    stage.style.setProperty('--drag-x', '0px');
    // NOTE: intentionally not using setPointerCapture because capturing the pointer on the
    // stage retargets the subsequent `click` event to the stage (so card selection
    // fails) and can wedge follow-up drags inside an iframe. Document-level
    // pointermove/up listeners already track the gesture reliably.
  }

  function onMouseDown(event) {
    if (dragState.active) return;
    onPointerDown(event);
  }

  function applyPointerMove(clientX) {
    if (!dragState.active) return;
    var stage = dragState.stage;
    if (stage && !stage.isConnected) stage = null;
    if (!stage) return;
    dragState.lastX = clientX;
    var delta = clientX - dragState.startX;
    if (Math.abs(delta) > 6) dragState.moved = true;
    var nextPosition = dragState.startPosition - (delta / dragState.step);
    if (nextPosition < 0) nextPosition = nextPosition * 0.28;
    if (nextPosition > works.length - 1) {
      nextPosition = (works.length - 1) + (nextPosition - (works.length - 1)) * 0.28;
    }
    state.position = clamp(nextPosition, -0.38, Math.max(0, works.length - 1) + 0.38);
    if (!updateShowcaseDom(true)) render();
  }

  function onPointerMove(event) {
    if (!dragState.active) return;
    queuedPointerX = event.clientX;
    if (pointerMoveFrame) return;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    pointerMoveFrame = raf(function () {
      pointerMoveFrame = 0;
      applyPointerMove(queuedPointerX);
    });
  }

  function onMouseMove(event) {
    if (!dragState.active) return;
    onPointerMove(event);
  }

  function onPointerUp(event) {
    if (!dragState.active) return;
    var section = document.getElementById('c-works');
    var stage = section && section.querySelector('[data-works-drag-stage]');
    dragState.active = false;
    dragState.stage = null;
    if (stage) {
      stage.classList.remove('is-dragging');
      stage.style.setProperty('--drag-x', '0px');
    }
    state.position = clamp(numeric(state.position, state.selected), 0, Math.max(0, works.length - 1));
    updateShowcaseDom(true);
    if (dragState.moved) {
      blockFollowupClick(140);
    }
    dragState.moved = false;
  }

  function onMouseUp(event) {
    onPointerUp(event);
  }

  function onPointerCancel(event) {
    if (!dragState.active) return;
    var section = document.getElementById('c-works');
    var stage = section && section.querySelector('[data-works-drag-stage]');
    dragState.active = false;
    dragState.moved = false;
    state.position = clamp(numeric(state.position, state.selected), 0, Math.max(0, works.length - 1));
    updateShowcaseDom(true);
    dragState.stage = null;
    if (stage) {
      stage.classList.remove('is-dragging');
      stage.style.setProperty('--drag-x', '0px');
    }
  }

  function isSectionVisible(section) {
    var rect = section.getBoundingClientRect();
    return rect.bottom > window.innerHeight * 0.25 && rect.top < window.innerHeight * 0.75;
  }

  function pauseWhenWorksHidden() {
    if (!state.playing) return;
    var section = document.getElementById('c-works');
    var activeChapter = (document.body && document.body.getAttribute('data-active-chapter')) || '';
    if (document.hidden || (activeChapter && activeChapter !== 'works') || !section || !isSectionVisible(section)) pauseAll();
  }

  function requestPauseWhenWorksHidden() {
    if (pauseVisibilityFrame) return;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 80); };
    pauseVisibilityFrame = raf(function () {
      pauseVisibilityFrame = 0;
      pauseWhenWorksHidden();
    });
  }

  function bindVisibilityPause() {
    var content = document.getElementById('content');
    window.addEventListener('scroll', requestPauseWhenWorksHidden, { passive: true });
    if (content) content.addEventListener('scroll', requestPauseWhenWorksHidden, { passive: true });
    document.addEventListener('visibilitychange', pauseWhenWorksHidden);
  }

  function scrollToWorksFromHash() {
    if (location.hash !== '#c-works') return;
    var content = document.getElementById('content');
    var section = document.getElementById('c-works');
    if (content && section && typeof content.scrollTo === 'function') {
      content.scrollTo({ top: section.offsetTop - 2, behavior: 'auto' });
    }
  }

  function ensureRoot() {
    var section = document.getElementById('c-works');
    if (!section) return null;
    section.classList.add('tt-gh-works');
    var app = document.getElementById('tt-gh-works-app');
    if (!app || !section.contains(app)) {
      section.innerHTML = '<div id="tt-gh-works-app" aria-live="off"></div>';
      app = document.getElementById('tt-gh-works-app');
    }
    app.setAttribute('aria-live', 'off');
    return app;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      if (works.length) render();
    }, 80);
  }

  function waitForHost(attempt) {
    attempt = attempt || 0;
    var app = ensureRoot();
    if (app) {
      render();
      setTimeout(scrollToWorksFromHash, 100);
      return;
    }
    if (attempt < 80) {
      setTimeout(function () { waitForHost(attempt + 1); }, 150);
    }
  }

  function embeddedData() {
    var node = document.getElementById('tt-works-data');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || '{}');
    } catch (error) {
      return null;
    }
  }

  // Keep only the selected work and its immediate neighbours warm. Preloading
  // the full archive pulled every high-resolution cover into the first visit.
  var _imgCache = new Map();
  var _neighbourPreloadTimer = 0;

  function cacheImage(url) {
    if (!url || _imgCache.has(url)) return;
    var image = new Image();
    image.decoding = 'async';
    image.loading = 'lazy';
    image.src = url;
    _imgCache.set(url, image);
  }

  function preloadCurrentWork(work) {
    if (!work) return;
    var trackIndex = activeTrackIndex(work);
    var track = work.tracks && work.tracks.length ? work.tracks[trackIndex] : null;
    var previousTrack = work.tracks && work.tracks[trackIndex - 1];
    var nextTrack = work.tracks && work.tracks[trackIndex + 1];
    cacheImage(work.image);
    cacheImage(track && track.image);
    cacheImage(previousTrack && previousTrack.image);
    cacheImage(nextTrack && nextTrack.image);
    variantsFor(work, trackIndex).forEach(function (version) { cacheImage(version && version.image); });
  }

  function preloadNearbyImages(index) {
    var selectedIndex = clamp(Number(index) || 0, 0, Math.max(0, works.length - 1));
    preloadCurrentWork(works[selectedIndex]);
    clearTimeout(_neighbourPreloadTimer);
    _neighbourPreloadTimer = setTimeout(function () {
      [selectedIndex - 1, selectedIndex + 1].forEach(function (workIndex) {
        var work = works[workIndex];
        if (!work) return;
        cacheImage(work.image || (localizedUnit(work) || {}).image);
      });
    }, 180);
  }

  function boot(json) {
    works = json.works || [];
    logos = json.clientLogos || [];
    state.selected = 0;
    resetSubState(works[0]);
    ensureSelectedVisible();
    preloadNearbyImages(0);
    setTimeout(function () { waitForHost(0); }, 260);
    setInterval(function () {
      if (rendering || !works.length) return;
      var app = document.getElementById('tt-gh-works-app');
      if (mounted && (!app || !app.querySelector('.tt-gh-shell'))) { scheduleRender(); return; }
    }, 1000);
  }

  function setEditorData(json) {
    if (!json || !json.works) return;
    works = json.works || [];
    logos = json.clientLogos || [];
    state.selected = clamp(state.selected, 0, Math.max(0, works.length - 1));
    resetSubState(currentWork());
    ensureSelectedVisible();
    preloadNearbyImages(state.selected);
    render();
  }

  function selectEditorWork(payload) {
    var index = payload && typeof payload === 'object' ? payload.index : payload;
    var track = payload && typeof payload === 'object' ? payload.track : null;
    var version = payload && typeof payload === 'object' ? payload.version : null;
    state.mode = 'showcase';
    if (!works.length) return;
    state.selected = clamp(Number(index) || 0, 0, works.length - 1);
    resetSubState(currentWork());
    var work = currentWork();
    if (track != null && work && work.tracks && work.tracks.length) {
      state.track = clamp(Number(track) || 0, 0, work.tracks.length - 1);
      state.bookOpen = true;
    }
    var variants = variantsFor(work, state.track);
    if (version != null && variants && variants.length) {
      var versionIndex = clamp(Number(version) || 0, 0, variants.length - 1);
      state.language = languageLabel(variants[versionIndex], versionIndex);
    } else {
      state.language = defaultLanguage(work, state.track);
    }
    ensureSelectedVisible();
    syncAudioState();
    if (!updateShowcaseDom()) render();
  }

  var globalUxState = {
    dialog: null,
    trigger: null,
    triggerDescriptor: null,
    inerted: [],
    menu: null,
    skipLink: null,
    routeLandingTimers: [],
    routeLandingScheduled: false,
    routeLandingInteracted: false,
    observer: null,
    chapterObserver: null
  };

  function activeNavId() {
    var chapter = (document.body && document.body.getAttribute('data-active-chapter')) || 'home';
    return {
      home: 'nav-0',
      translation: 'nav-0',
      projects: 'nav-2',
      members: 'nav-3',
      works: 'nav-4',
      news: 'nav-5',
      contact: 'nav-6'
    }[chapter] || 'nav-0';
  }

  function localizedUiLabel(ko, en, jp) {
    var language = pageLangKey();
    if (language === 'en') return en;
    if (language === 'jp') return jp;
    return ko;
  }

  function activeSectionId() {
    var chapter = (document.body && document.body.getAttribute('data-active-chapter')) || 'home';
    return {
      home: 'c-home',
      translation: 'c-translation',
      projects: 'c-projects',
      members: 'c-members',
      works: 'c-works',
      news: 'c-news',
      contact: 'c-contact'
    }[chapter] || 'c-home';
  }

  function onSkipLinkClick(event) {
    if (!event.target || !event.target.closest || !event.target.closest('#tt-skip-link')) return;
    event.preventDefault();
    var target = document.getElementById(activeSectionId()) || document.getElementById('content');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function ensureSkipLink() {
    if (!document.body) return;
    var content = document.getElementById('content');
    if (content && !content.hasAttribute('role')) content.setAttribute('role', 'main');
    var link = globalUxState.skipLink || document.getElementById('tt-skip-link');
    if (!link) {
      link = document.createElement('a');
      link.id = 'tt-skip-link';
      link.className = 'tt-skip-link';
      link.href = '#content';
      document.body.insertBefore(link, document.body.firstChild);
      globalUxState.skipLink = link;
    }
    var label = localizedUiLabel('본문으로 바로가기', 'Skip to main content', '本文へ移動');
    if (link.textContent !== label) link.textContent = label;
    link.setAttribute('aria-label', label);
  }

  function routeSectionId() {
    var path = String((location && location.pathname) || '/').toLowerCase();
    if (path.indexOf('/story-types/') !== -1 || path.indexOf('/projects/') !== -1) return 'c-projects';
    if (path.indexOf('/members/') !== -1) return 'c-members';
    if (path.indexOf('/works/') !== -1) return 'c-works';
    if (path.indexOf('/news/') !== -1) return 'c-news';
    if (path.indexOf('/contact/') !== -1) return 'c-contact';
    return '';
  }

  function clearRouteLandingTimers() {
    globalUxState.routeLandingTimers.forEach(function (timer) {
      clearTimeout(timer);
      clearInterval(timer);
    });
    globalUxState.routeLandingTimers = [];
  }

  function markRouteLandingInteraction(event) {
    if (event && event.isTrusted === false) return;
    globalUxState.routeLandingInteracted = true;
    clearRouteLandingTimers();
  }

  function syncRouteLandingUi(scroller, expectedChapter) {
    var number = {
      projects: '03',
      members: '04',
      works: '05',
      news: '06',
      contact: '07'
    }[expectedChapter];
    if (document.body) document.body.setAttribute('data-active-chapter', expectedChapter);
    var pnum = document.getElementById('pnum');
    if (pnum && number) pnum.textContent = number;
    var maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    var progressValue = clamp((scroller.scrollTop / maxScroll) * 100, 0, 100);
    var pbar = document.getElementById('pbar');
    if (pbar) pbar.style.width = progressValue.toFixed(4) + '%';
    var progress = document.getElementById('progress');
    if (progress && progress.getAttribute('role') === 'progressbar') progress.setAttribute('aria-valuenow', String(Math.round(progressValue)));
    window.dispatchEvent(new CustomEvent('TALETONE_CHAPTER_CHANGE', { detail: { chapter: expectedChapter } }));
  }

  function scheduleRouteLandingCorrections() {
    if (globalUxState.routeLandingScheduled) return;
    var sectionId = routeSectionId();
    if (!sectionId) return;
    globalUxState.routeLandingScheduled = true;
    var navId = {
      'c-projects': 'nav-2',
      'c-members': 'nav-3',
      'c-works': 'nav-4',
      'c-news': 'nav-5',
      'c-contact': 'nav-6'
    }[sectionId];
    var expectedChapter = {
      'c-projects': 'projects',
      'c-members': 'members',
      'c-works': 'works',
      'c-news': 'news',
      'c-contact': 'contact'
    }[sectionId];
    globalUxState.routeLandingInteracted = false;
    clearRouteLandingTimers();
    var attempts = 0;
    var routeWatcher = setInterval(function () {
      attempts += 1;
      if (globalUxState.routeLandingInteracted) {
        clearRouteLandingTimers();
        return;
      }
      var scroller = document.getElementById('content');
      var section = document.getElementById(sectionId);
      if (!scroller || !section) {
        if (attempts >= 24) clearRouteLandingTimers();
        return;
      }
      var top = section.getBoundingClientRect().top;
      var activeChapter = document.body && document.body.getAttribute('data-active-chapter');
      if (activeChapter === expectedChapter && Math.abs(top) <= 320) {
        clearRouteLandingTimers();
        return;
      }
      if (Math.abs(top) <= 96) {
        syncRouteLandingUi(scroller, expectedChapter);
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        window.dispatchEvent(new Event('scroll'));
        clearRouteLandingTimers();
        return;
      } else if (attempts === 1) {
        scroller.scrollTo({ top: Math.max(0, section.offsetTop - 2), behavior: 'auto' });
        syncRouteLandingUi(scroller, expectedChapter);
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        window.dispatchEvent(new Event('scroll'));
        return;
      } else if (attempts === 4 || attempts === 8) {
        var navLink = navId ? document.getElementById(navId) : null;
        if (navLink) navLink.click();
      } else if (attempts === 12) {
        scroller.scrollTo({ top: Math.max(0, section.offsetTop - 2), behavior: 'auto' });
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
      if (attempts >= 24) clearRouteLandingTimers();
    }, 250);
    globalUxState.routeLandingTimers.push(routeWatcher);
  }

  function closeMobileChapterMenu(restoreFocus) {
    var progress = document.getElementById('progress');
    if (!document.body || !document.body.classList.contains('tt-mobile-chapter-open')) return;
    document.body.classList.remove('tt-mobile-chapter-open');
    if (progress) progress.setAttribute('aria-expanded', 'false');
    if (restoreFocus && progress) progress.focus({ preventScroll: true });
  }

  function toggleMobileChapterMenu() {
    if (window.innerWidth > 760 || !document.body || globalUxState.dialog) return;
    var progress = document.getElementById('progress');
    var opening = !document.body.classList.contains('tt-mobile-chapter-open');
    document.body.classList.toggle('tt-mobile-chapter-open', opening);
    if (progress) progress.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening && globalUxState.menu) {
      var current = globalUxState.menu.querySelector('[aria-current="page"]');
      var first = current || globalUxState.menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function ensureMobileChapterMenu() {
    var nav = document.getElementById('chapnav');
    var progress = document.getElementById('progress');
    if (!nav || !progress || !document.body) return;

    if (!globalUxState.menu) {
      var menu = document.createElement('nav');
      menu.id = 'tt-mobile-chapter-menu';
      menu.setAttribute('aria-label', localizedUiLabel('챕터 이동', 'Chapter navigation', 'チャプター移動'));
      nav.querySelectorAll('.navbtn').forEach(function (navButton) {
        var link = document.createElement('a');
        link.href = navButton.getAttribute('href') || '/';
        link.dataset.navId = navButton.id || '';
        var label = navButton.querySelector('.nav-label');
        link.textContent = (label && label.textContent.trim()) || navButton.textContent.trim();
        link.addEventListener('click', function () { closeMobileChapterMenu(false); });
        menu.appendChild(link);
      });
      document.body.appendChild(menu);
      globalUxState.menu = menu;
    }

    progress.setAttribute('aria-label', localizedUiLabel('챕터 메뉴 열기', 'Open chapter menu', 'チャプターメニューを開く'));
    progress.setAttribute('aria-haspopup', 'menu');
    progress.setAttribute('aria-controls', 'tt-mobile-chapter-menu');
    progress.setAttribute('aria-expanded', document.body.classList.contains('tt-mobile-chapter-open') ? 'true' : 'false');
    if (!progress.dataset.ttChapterBound) {
      progress.dataset.ttChapterBound = 'true';
      progress.addEventListener('click', toggleMobileChapterMenu);
    }
  }

  function refreshChapterControls() {
    var nav = document.getElementById('chapnav');
    var progress = document.getElementById('progress');
    if (!nav || !progress) return;
    var currentId = activeNavId();
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', localizedUiLabel('주요 섹션', 'Main sections', 'メインセクション'));
    nav.querySelectorAll('.navbtn').forEach(function (button) {
      var active = button.id === currentId;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    ensureMobileChapterMenu();
    if (globalUxState.menu) {
      globalUxState.menu.querySelectorAll('a').forEach(function (link) {
        if (link.dataset.navId === currentId) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }

    if (window.innerWidth <= 760) {
      progress.setAttribute('role', 'button');
      progress.setAttribute('tabindex', '0');
      progress.removeAttribute('aria-valuemin');
      progress.removeAttribute('aria-valuemax');
      progress.removeAttribute('aria-valuenow');
    } else {
      closeMobileChapterMenu(false);
      progress.setAttribute('role', 'progressbar');
      progress.removeAttribute('tabindex');
      progress.removeAttribute('aria-haspopup');
      progress.removeAttribute('aria-controls');
      progress.removeAttribute('aria-expanded');
      progress.setAttribute('aria-label', localizedUiLabel('사이트 탐색 진행도', 'Site journey progress', 'サイト進行状況'));
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      var bar = document.getElementById('pbar');
      progress.setAttribute('aria-valuenow', String(Math.round(parseFloat((bar && bar.style.width) || '0') || 0)));
    }

    var currentLanguage = pageLangKey();
    [['lang-kr', 'kr'], ['lang-en', 'en'], ['lang-jp', 'jp']].forEach(function (entry) {
      var button = document.getElementById(entry[0]);
      if (button) button.setAttribute('aria-pressed', entry[1] === currentLanguage ? 'true' : 'false');
    });
  }

  function interactiveCardLabel(card, kind) {
    var image = card.querySelector('img[alt]');
    var name = image && image.getAttribute('alt');
    if (!name) {
      var heading = card.querySelector('h2,h3,[style*="font-size:21px"],[style*="font-size: 21px"]');
      name = heading && heading.textContent.trim();
    }
    name = name || card.textContent.trim().split(/\n+/)[0] || 'TALETONE';
    if (kind === 'member') return name + localizedUiLabel(' 멤버 상세', ' member details', ' メンバー詳細');
    return name + localizedUiLabel(' 기사 상세', ' article details', ' 記事詳細');
  }

  function patchInteractiveCards() {
    document.querySelectorAll('#c-members .tt-member-card, #c-news .lift').forEach(function (card) {
      var kind = card.classList.contains('tt-member-card') ? 'member' : 'news';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-label', interactiveCardLabel(card, kind));
      card.dataset.ttDialogTrigger = 'true';
    });
  }

  function fallbackCopyText(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    field.remove();
    return copied;
  }

  function copyContactEmail() {
    var email = 'contact@taletone.net';
    var clipboardWrite = null;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { clipboardWrite = navigator.clipboard.writeText(email); } catch (error) { clipboardWrite = null; }
    }
    var fallbackCopied = fallbackCopyText(email);
    if (clipboardWrite) {
      return clipboardWrite
        .then(function () { return true; })
        .catch(function () { return fallbackCopied; });
    }
    return Promise.resolve(fallbackCopied);
  }

  function patchContactControls() {
    var section = document.getElementById('c-contact');
    if (!section) return;
    var emailLink = section.querySelector('a[href^="mailto:"]');
    if (emailLink) emailLink.setAttribute('aria-label', localizedUiLabel('프로젝트 문의 이메일 열기', 'Open project inquiry email', 'プロジェクト問い合わせメールを開く'));
    section.querySelectorAll('button').forEach(function (button) {
      var text = button.textContent.trim();
      if (!/복사|copy|コピー/i.test(text)) return;
      var defaultLabel = localizedUiLabel('이메일 주소 복사', 'Copy email address', 'メールアドレスをコピー');
      button.setAttribute('type', 'button');
      button.setAttribute('aria-live', 'polite');
      button.setAttribute('aria-atomic', 'true');
      if (!button.ttCopyResetTimer) {
        button.dataset.ttCopyLabel = text || defaultLabel;
        button.setAttribute('aria-label', defaultLabel);
      }
      if (button.dataset.ttCopyBound) return;
      button.dataset.ttCopyBound = 'true';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var feedback = section.querySelector('#email-copy-feedback');
        copyContactEmail().then(function (copied) {
          var message = copied
            ? localizedUiLabel('복사됨', 'Copied', 'コピーしました')
            : localizedUiLabel('복사 실패', 'Copy failed', 'コピーできませんでした');
          button.textContent = message;
          button.setAttribute('aria-label', message);
          if (feedback) feedback.textContent = message;
          if (button.ttCopyResetTimer) clearTimeout(button.ttCopyResetTimer);
          button.ttCopyResetTimer = setTimeout(function () {
            var copyLabel = localizedUiLabel('이메일 주소 복사', 'Copy email address', 'メールアドレスをコピー');
            button.ttCopyResetTimer = 0;
            button.dataset.ttCopyLabel = copyLabel;
            button.textContent = button.dataset.ttCopyLabel || copyLabel;
            button.setAttribute('aria-label', copyLabel);
            if (feedback) feedback.textContent = '';
          }, 1800);
        });
      });
    });
  }

  function findSiteDialog() {
    var explicit = document.querySelector('.tt-gh-modal[role="dialog"], .tt-member-modal');
    if (explicit) return explicit;
    var nodes = document.querySelectorAll('div[style]');
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      if (node.style.position !== 'fixed' || Number(node.style.zIndex || 0) < 300) continue;
      if (node.querySelector('image-slot') && node.querySelector('h3')) {
        node.classList.add('tt-news-modal');
        return node;
      }
    }
    return null;
  }

  function setSiblingsInert(dialog) {
    globalUxState.inerted = [];
    var current = dialog;
    while (current && current.parentElement && current.parentElement !== document.body) {
      Array.prototype.forEach.call(current.parentElement.children, function (sibling) {
        if (sibling === current || sibling.nodeType !== 1 || sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') return;
        globalUxState.inerted.push({
          node: sibling,
          inert: !!sibling.inert,
          ariaHidden: sibling.getAttribute('aria-hidden')
        });
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      });
      current = current.parentElement;
    }
  }

  function restoreInertSiblings() {
    globalUxState.inerted.forEach(function (record) {
      if (!record.node || !record.node.isConnected) return;
      record.node.inert = record.inert;
      if (record.ariaHidden == null) record.node.removeAttribute('aria-hidden');
      else record.node.setAttribute('aria-hidden', record.ariaHidden);
    });
    globalUxState.inerted = [];
  }

  function dialogFocusable(dialog) {
    return Array.prototype.filter.call(dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (node) {
      return !node.hasAttribute('hidden') && node.getClientRects().length > 0;
    });
  }

  function rememberDialogTrigger(trigger) {
    if (!trigger) return;
    globalUxState.trigger = trigger;
    globalUxState.triggerDescriptor = {
      action: trigger.getAttribute('data-works-action') || '',
      index: trigger.getAttribute('data-index') || '',
      label: trigger.getAttribute('aria-label') || ''
    };
  }

  function restoreDialogTriggerFocus() {
    var trigger = globalUxState.trigger;
    var descriptor = globalUxState.triggerDescriptor || {};
    if (!trigger || !trigger.isConnected) {
      trigger = Array.prototype.find.call(document.querySelectorAll('[data-tt-dialog-trigger], [data-works-action="gallery-open"], [data-works-action="video-open"]'), function (candidate) {
        if (descriptor.action) {
          return candidate.getAttribute('data-works-action') === descriptor.action && candidate.getAttribute('data-index') === descriptor.index;
        }
        return descriptor.label && candidate.getAttribute('aria-label') === descriptor.label;
      }) || null;
    }
    if (trigger && trigger.isConnected) {
      globalUxState.trigger = trigger;
      trigger.focus({ preventScroll: true });
    }
  }

  function activateSiteDialog(dialog) {
    if (!dialog || dialog === globalUxState.dialog) return;
    if (globalUxState.dialog) deactivateSiteDialog(false);
    closeMobileChapterMenu(false);
    globalUxState.dialog = dialog;
    dialog.classList.add('tt-site-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');

    var heading = dialog.querySelector('.tt-member-brand, h3');
    if (heading && !dialog.hasAttribute('aria-label')) {
      if (!heading.id) heading.id = 'tt-dialog-title-' + Date.now();
      dialog.setAttribute('aria-labelledby', heading.id);
    }
    var panel = dialog.querySelector('.tt-member-panel, .tt-gh-modal-panel') || dialog.firstElementChild;
    if (panel) panel.setAttribute('role', 'document');
    var close = dialog.querySelector('.tt-member-close, .tt-gh-modal-close, :scope > div > button');
    if (close) {
      close.setAttribute('type', 'button');
      if (!close.getAttribute('aria-label')) close.setAttribute('aria-label', close.textContent.trim() || 'Close');
    }
    setSiblingsInert(dialog);
    if (document.body) document.body.classList.add('tt-site-dialog-open');
    setTimeout(function () {
      var target = close || dialogFocusable(dialog)[0] || dialog;
      if (target && target.isConnected) target.focus({ preventScroll: true });
    }, 60);
  }

  function deactivateSiteDialog(restoreFocus) {
    if (!globalUxState.dialog) return;
    globalUxState.dialog = null;
    restoreInertSiblings();
    if (document.body) document.body.classList.remove('tt-site-dialog-open');
    if (restoreFocus) setTimeout(restoreDialogTriggerFocus, 60);
  }

  function refreshSiteDialog() {
    var found = findSiteDialog();
    if (found === globalUxState.dialog) return;
    if (!found) {
      deactivateSiteDialog(true);
      return;
    }
    activateSiteDialog(found);
  }

  function refreshGlobalUx() {
    refreshChapterControls();
    ensureSkipLink();
    patchInteractiveCards();
    patchContactControls();
    refreshSiteDialog();
    scheduleRouteLandingCorrections();
  }

  function onGlobalUxKeydown(event) {
    var target = event.target;
    if ((event.key === 'Enter' || event.key === ' ') && target && target.dataset && target.dataset.ttDialogTrigger === 'true') {
      event.preventDefault();
      rememberDialogTrigger(target);
      target.click();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && target && target.id === 'progress' && window.innerWidth <= 760) {
      event.preventDefault();
      toggleMobileChapterMenu();
      return;
    }
    if (event.key === 'Escape' && document.body && document.body.classList.contains('tt-mobile-chapter-open')) {
      event.preventDefault();
      closeMobileChapterMenu(true);
      return;
    }
    var dialog = globalUxState.dialog;
    if (!dialog) return;
    if (event.key === 'Escape') {
      var close = dialog.querySelector('.tt-member-close, .tt-gh-modal-close, :scope > div > button');
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = dialogFocusable(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function initGlobalUx() {
    refreshGlobalUx();
    window.addEventListener('wheel', markRouteLandingInteraction, { passive: true, capture: true });
    window.addEventListener('touchstart', markRouteLandingInteraction, { passive: true, capture: true });
    window.addEventListener('pointerdown', markRouteLandingInteraction, { passive: true, capture: true });
    window.addEventListener('keydown', function (event) {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].indexOf(event.key) !== -1) markRouteLandingInteraction(event);
    }, true);
    document.addEventListener('keydown', onGlobalUxKeydown, true);
    document.addEventListener('click', onSkipLinkClick, true);
    document.addEventListener('pointerdown', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-tt-dialog-trigger], [data-works-action="gallery-open"], [data-works-action="video-open"]') : null;
      if (trigger) rememberDialogTrigger(trigger);
      if (document.body && document.body.classList.contains('tt-mobile-chapter-open')) {
        var progress = document.getElementById('progress');
        if ((!globalUxState.menu || !globalUxState.menu.contains(event.target)) && (!progress || !progress.contains(event.target))) {
          closeMobileChapterMenu(false);
        }
      }
    }, true);
    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('#lang-switcher')) {
        setTimeout(refreshChapterControls, 40);
      }
    }, true);
    window.addEventListener('resize', refreshChapterControls, { passive: true });
    globalUxState.observer = new MutationObserver(function () { refreshGlobalUx(); });
    globalUxState.observer.observe(document.body, { childList: true, subtree: true });
    globalUxState.chapterObserver = new MutationObserver(refreshChapterControls);
    globalUxState.chapterObserver.observe(document.body, { attributes: true, attributeFilter: ['data-active-chapter'] });
    globalUxState.chapterObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  window.TALETONE_WORKS_API = {
    setData: setEditorData,
    setMeta: setMeta,
    select: selectEditorWork,
    pauseAll: pauseAll
  };

  window.addEventListener('TALETONE_CHAPTER_CHANGE', function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (detail.chapter && detail.chapter !== 'works') pauseAll();
  });

  window.addEventListener('message', function (event) {
    var message = event.data || {};
    if (message.type === 'TALETONE_WORKS_SET_DATA') setEditorData(message.data);
    if (message.type === 'TALETONE_SITE_SET_DATA' && message.data) setMeta(message.data.worksMeta || {});
    if (message.type === 'TALETONE_SET_LANG' && mounted) render();
    if (message.type === 'TALETONE_WORKS_SELECT') selectEditorWork(message);
  });

  function init() {
    if (location.protocol === 'file:') {
      var localData = embeddedData();
      if (localData && localData.works) {
        boot(localData);
        return;
      }
    }
    fetch(new URL('data/works-data.json', assetBase).href)
      .then(function (response) { return response.json(); })
      .then(boot)
      .catch(function (error) {
        var fallback = embeddedData();
        if (fallback && fallback.works) boot(fallback);
        else console.error('[works]', error);
      });
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('dragstart', onNativeDragStart, true);
  document.addEventListener('selectstart', onNativeSelectStart, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onPointerUp, true);
  window.addEventListener('mouseup', onMouseUp, true);
  window.addEventListener('hashchange', scrollToWorksFromHash);
  bindVisibilityPause();
  function start() {
    initStructuredDataGuard();
    initGlobalUx();
    init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
