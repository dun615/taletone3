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
  var dragState = { active: false, startX: 0, lastX: 0, anchorX: 0, moved: false, stage: null };
  var suppressClick = false;
  var pointerMoveFrame = 0;
  var queuedPointerX = 0;
  var pauseVisibilityFrame = 0;
var audioPool = new Map();

  var state = {
    mode: 'showcase',
    selected: 0,
    start: 0,
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

  function variantsFor(work, trackIndex) {
    if (!work) return [];
    var track = work.tracks && work.tracks.length ? work.tracks[clamp(trackIndex, 0, work.tracks.length - 1)] : null;
    if (track && track.versions && track.versions.length) return track.versions;
    if ((!track || !track.audio) && work.versions && work.versions.length) return work.versions;
    return [{
      language: 'MAIN',
      title: track && track.title ? track.title : work.title,
      date: track && track.date ? track.date : work.date,
      type: track && track.type ? track.type : work.type,
      description: track && track.description ? track.description : work.description,
      credits: track && track.credits ? track.credits : work.credits,
      image: track && track.image ? track.image : work.image,
      audio: track && track.audio ? track.audio : work.audio,
      fit: track && track.fit ? track.fit : work.fit,
      posX: track && track.posX ? track.posX : work.posX,
      posY: track && track.posY ? track.posY : work.posY,
      brightness: track && track.brightness ? track.brightness : work.brightness
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
    var track = work.tracks && work.tracks.length ? work.tracks[trackIndex] : null;
    var version = activeVariant(work, trackIndex);
    var kind = itemKind(work);
    var coverOnly = (kind === 'album' || kind === 'ep') && !state.bookOpen;
    var source = coverOnly ? work : Object.assign({}, work, track || {}, version || {});
    return Object.assign({}, work, track || {}, version || {}, {
      title: source.title || work.title,
      date: source.date || work.date,
      type: source.type || work.type,
      description: source.description || work.description || '',
      credits: source.credits || work.credits || '',
      format: source.format || work.format || '',
      image: source.image || work.image,
      audio: (version && version.audio) || (track && track.audio) || work.audio,
      youtube: coverOnly ? (work.youtube || '') : ((version && version.youtube) || (track && track.youtube) || work.youtube || ''),
      fit: source.fit || work.fit || 'cover',
      posX: source.posX || work.posX || '50%',
      posY: source.posY || work.posY || '50%',
      brightness: source.brightness != null ? source.brightness : (work.brightness != null ? work.brightness : 1),
      responsive: source.responsive || work.responsive || null
    });
  }

  function trackLabel(work) {
    if (!work || !work.tracks || !work.tracks.length) return 'Single';
    var index = activeTrackIndex(work);
    var track = work.tracks[index];
    return 'Track ' + pad(track.trackNo || index + 1) + (index === titleTrackIndex(work) || track.isTitle ? ' (Title)' : '');
  }

  function imgTag(unit, className) {
    if (!unit || !unit.image) return '<span class="' + esc(className || '') + '"></span>';
    return '<img class="' + esc(className || '') + '" src="' + esc(unit.image) + '" alt="' + esc(plainRichText(unit.title || '')) + '" style="' + imageStyle(unit) + '">';
  }

  function numeric(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function imageStyle(unit) {
    var brightness = numeric(unit && unit.brightness, 1);
    return '--fit:' + esc((unit && unit.fit) || 'cover') + ';--pos-x:' + esc((unit && unit.posX) || '50%') + ';--pos-y:' + esc((unit && unit.posY) || '50%') + ';--brightness:' + esc(brightness);
  }

  function editorBreakpoint() {
    var width = window.innerWidth || document.documentElement.clientWidth || 1440;
    if (width <= 720) return 'mobile';
    if (width <= 1100) return 'tablet';
    return 'desktop';
  }

  function responsiveOverride(unit) {
    var responsive = unit && unit.responsive;
    var bp = editorBreakpoint();
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
    state.start = clamp(state.start, 0, maxStart);
    if (state.selected < state.start) state.start = state.selected;
    if (state.selected >= state.start + visibleCount) state.start = state.selected - (visibleCount - 1);
    state.start = clamp(state.start, 0, maxStart);
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
      audio.preload = 'auto';
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

  function tabs() {
    var meta = localizedMeta();
    return '<div class="tt-gh-tabs" role="tablist"><button type="button" data-works-action="mode" data-mode="showcase" class="' + (state.mode === 'showcase' ? 'is-active' : '') + '">' + preserve(meta.showcaseLabel) + '</button><button type="button" data-works-action="mode" data-mode="gallery" class="' + (state.mode === 'gallery' ? 'is-active' : '') + '">' + preserve(meta.galleryLabel) + '</button></div>';
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
    if (index !== state.selected) return Object.assign({}, work, {
      brightness: work && work.brightness != null ? work.brightness : 1,
      responsive: work && work.responsive ? work.responsive : null
    });
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
    var start = clamp(state.start, 0, maxStart);
    var offset = index - start;
    var slot = slots[offset];
    if (slot) {
      return {
        visible: true,
        left: slot.left,
        top: slot.top,
        rot: slot.rot,
        scale: index === state.selected ? (slot.activeScale || 1.05) : (slot.scale || 1),
        z: index === state.selected ? 9 : slots.length - Math.abs(offset - (slots.length - 1) / 2),
        delay: (index % slots.length) * -0.8
      };
    }
    return {
      visible: false,
      left: index < start ? -8 : 108,
      top: '16%',
      rot: index < start ? -8 : 8,
      scale: .86,
      z: 0,
      delay: (index % slots.length) * -0.8
    };
  }

  function cardStyle(layout, unit) {
    var res = responsiveOverride(unit);
    return '--left:' + layout.left + '%;--top:' + layout.top + ';--rot:' + layout.rot + 'deg;--scale:' + layout.scale + ';--z:' + layout.z + ';--opacity:' + (layout.visible ? 1 : 0) + ';--float-delay:' + layout.delay + 's;--card-scale-override:' + res.cardScale + ';--title-scale:' + res.titleSize + ';--offset-x:' + res.offsetX + 'px;--offset-y:' + res.offsetY + 'px';
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
      return '<div role="button" tabindex="0" class="tt-gh-card ' + (active ? 'is-active ' : '') + (layout.visible ? 'is-visible' : 'is-hidden') + '" data-works-card data-works-action="select" data-index="' + index + '" style="' + cardStyle(layout, unit) + '"><span class="tt-gh-pin"></span><span class="tt-gh-card-inner"><span class="tt-gh-card-cover">' + imgTag(unit, '') + cardPlay(work, index, unit) + cardTabs(work, index) + albumPager(work, index) + '</span><span class="tt-gh-card-meta"><span class="tt-gh-card-title">' + compactRichLabel(unit.title || work.title, 18) + '</span><span class="tt-gh-card-type">' + compactRichLabel(unit.type || work.type || itemKind(work), 20) + '</span></span></span>' + cardPreview(work) + '</div>';
    }).join('');
    return '<div class="tt-gh-stage" data-works-drag-stage><div class="tt-gh-waves"><i class="tt-gh-line"></i><i class="tt-gh-line"></i><i class="tt-gh-line"></i><i class="tt-gh-line"></i></div><div class="tt-gh-showcase" data-works-drag-track>' + cards + '</div>' + segments() + '</div>';
  }

  function videoLightbox() {
    if (!state.videoOpen) return '';
    var work = currentWork();
    if (!work) return '';
    var unit = mergeDisplayUnit(work);
    var meta = localizedMeta();
    return '<div class="tt-gh-modal tt-gh-video-modal" role="dialog" aria-modal="true"><button type="button" class="tt-gh-modal-backdrop" data-works-action="video-close" aria-label="' + esc(plainRichText(meta.closeLabel || 'Close')) + ' video"></button><section class="tt-gh-modal-panel tt-gh-video-panel"><button type="button" class="tt-gh-modal-close" data-works-action="video-close">' + preserve(meta.closeLabel) + '</button><div class="tt-gh-modal-video">' + modalVideo(unit) + '</div></section></div>';
  }

  function segments() {
    return '<div class="tt-gh-segments" style="--count:' + works.length + '">' + works.map(function (_work, index) {
      return '<button type="button" class="' + (index === state.selected ? 'is-active' : '') + '" data-works-action="select" data-index="' + index + '" aria-label="Select work ' + (index + 1) + '"></button>';
    }).join('') + '</div>';
  }

  function gallery() {
    return '<div class="tt-gh-gallery">' + works.map(function (work, index) {
      return '<div role="button" tabindex="0" class="tt-gh-gallery-card" data-works-action="gallery-open" data-index="' + index + '"><span class="tt-gh-card-inner"><span class="tt-gh-card-cover">' + imgTag(work, '') + cardTabs(work, index) + albumPager(work, index) + '</span><span class="tt-gh-card-meta"><span class="tt-gh-card-title">' + compactRichLabel(work.title, 18) + '</span><span class="tt-gh-card-type">' + compactRichLabel(work.type || itemKind(work), 20) + '</span></span></span></div>';
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
    return '<div class="tt-gh-modal" role="dialog" aria-modal="true"><button type="button" class="tt-gh-modal-backdrop" data-works-action="modal-close" aria-label="' + esc(plainRichText(meta.closeLabel || 'Close')) + ' detail"></button><section class="tt-gh-modal-panel"><button type="button" class="tt-gh-modal-close" data-works-action="modal-close">' + preserve(meta.closeLabel) + '</button><div class="tt-gh-modal-main"><div class="tt-gh-modal-video">' + modalVideo(unit) + '</div><div class="tt-gh-modal-copy"><span class="tt-gh-info-kicker"><i></i> ' + preserve(meta.detailLabel) + '</span><h3>' + preserve(unit.title || work.title) + '</h3><p style="white-space:pre-wrap">' + preserve(unit.description || work.description || 'TALETONE MUSIC archive.') + '</p>' + detailTable(work, unit, kind, format) + (controls ? '<div class="tt-gh-side">' + controls + '</div>' : '') + '</div></div><aside class="tt-gh-modal-credits"><span class="tt-gh-info-kicker"><i></i> ' + preserve(meta.creditsLabel) + '</span><pre>' + preserve(creditsText(work, unit)) + '</pre></aside></section></div>';
  }

  function syncModalBodyClass() {
    document.body.classList.toggle('tt-works-modal-open', !!(state.modalOpen || state.videoOpen));
  }

  function render() {
    root = ensureRoot();
    if (!root || !works.length) return;
    rendering = true;
    ensureSelectedVisible();
    root.innerHTML = '<div class="tt-gh-shell">' + head() + clients() + tabs() + (state.mode === 'gallery' ? gallery() : showcase()) + (state.mode === 'showcase' ? infoPanel() : '') + galleryModal() + videoLightbox() + '</div>';
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
        state.videoOpen = false;
        render();
      };
      node.onpointerdown = node.onclick;
    });
    root.querySelectorAll('[data-works-action="modal-close"]').forEach(function (node) {
      node.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        state.modalOpen = false;
        render();
      };
      node.onpointerdown = node.onclick;
    });
  }

  function updateShowcaseDom() {
    if (!root || state.mode !== 'showcase') return false;
    var stage = root.querySelector('[data-works-drag-stage]');
    if (!stage) return false;
    root.querySelectorAll('[data-works-card]').forEach(function (card) {
      var index = Number(card.getAttribute('data-index')) || 0;
      var layout = layoutForIndex(index);
      card.classList.toggle('is-active', index === state.selected);
      card.classList.toggle('is-visible', layout.visible);
      card.classList.toggle('is-hidden', !layout.visible);
      var work = works[index];
      var unit = cardUnit(work, index);
      card.setAttribute('style', cardStyle(layout, unit));
      var img = card.querySelector('.tt-gh-card-cover img');
      if (img && unit && unit.image) {
        if (img.getAttribute('src') !== unit.image) img.setAttribute('src', unit.image);
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
    var segmentNode = root.querySelector('.tt-gh-segments');
    if (segmentNode) segmentNode.outerHTML = segments();
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
      var videoIndex = button.hasAttribute('data-index') ? Number(button.getAttribute('data-index')) : state.selected;
      if (Number.isFinite(videoIndex)) {
        state.selected = clamp(videoIndex, 0, works.length - 1);
        resetSubState(currentWork());
        ensureSelectedVisible();
      }
      state.videoOpen = true;
      render();
      return;
    }
    if (action === 'video-close') {
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
      state.selected = clamp(Number(button.getAttribute('data-index')) || 0, 0, works.length - 1);
      resetSubState(currentWork());
      state.modalOpen = true;
      syncAudioState();
      render();
      return;
    }
    if (action === 'modal-close') {
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
    var actionable = event.target && event.target.closest ? event.target.closest('[role="button"][data-works-action]') : null;
    if (actionable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      actionable.click();
      return;
    }
    var section = document.getElementById('c-works');
    if (!section || !isSectionVisible(section)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
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

  function onPointerDown(event) {
    if (dragState.active) return;
    var actionButton = event.target && event.target.closest ? event.target.closest('[data-works-action]') : null;
    var action = actionButton ? actionButton.getAttribute('data-works-action') : '';
    if (action === 'video-close' || action === 'modal-close') {
      event.preventDefault();
      event.stopPropagation();
      if (action === 'video-close') state.videoOpen = false;
      if (action === 'modal-close') state.modalOpen = false;
      render();
      return;
    }
    var section = document.getElementById('c-works');
    if (!section || !section.contains(event.target)) return;
    var stage = event.target && event.target.closest ? event.target.closest('[data-works-drag-stage]') : null;
    if (!stage || !section.contains(stage)) return;
    if (event.target.closest('[data-works-action="prev"],[data-works-action="next"],[data-works-action="card-language"],[data-works-action="album-prev"],[data-works-action="album-next"],[data-works-action="video-open"],.tt-gh-card-play,.tt-gh-tabs,.tt-gh-segments,.tt-gh-info,.tt-gh-modal,input,button.tt-gh-action,button.tt-gh-select,.tt-gh-card-tab,.tt-gh-album-turn')) return;
    dragState.active = true;
    dragState.startX = event.clientX;
    dragState.lastX = event.clientX;
    dragState.anchorX = event.clientX;
    dragState.moved = false;
    dragState.stage = stage;
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
    if (Math.abs(clientX - dragState.startX) > 6) dragState.moved = true;
    // Live stepping: every STEP_PX dragged advances one card, so a fast sweep
    // flips through the deck continuously instead of waiting for release.
    var STEP_PX = 56;
    var fromAnchor = clientX - dragState.anchorX;
    var steps = (fromAnchor / STEP_PX) | 0; // toward 0
    if (steps !== 0) {
      go(steps < 0 ? Math.abs(steps) : -Math.abs(steps)); // drag left: next, drag right: prev
      dragState.anchorX += steps * STEP_PX;
      dragState.stage = stage;
      stage.style.setProperty('--drag-x', '0px');
      return;
    }
    // Residual sub-step movement gives a gentle damped nudge for tactile feedback.
    var dx = Math.max(-40, Math.min(40, (clientX - dragState.anchorX) * 0.5));
    stage.style.setProperty('--drag-x', dx + 'px');
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
    if (!dragState.active || event.buttons === 0) return;
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
    // Stepping already happened live during the move; nothing to commit here.
    if (dragState.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 80);
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
      section.innerHTML = '<div id="tt-gh-works-app" aria-live="polite"></div>';
      app = document.getElementById('tt-gh-works-app');
    }
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

  // #7 preload every track/version cover so album page-turns never flash a blank
  // frame while a new image loads over the network.
  var _imgCache = [];
  function preloadAllImages() {
    var urls = {};
    works.forEach(function (w) {
      if (w.image) urls[w.image] = 1;
      (w.tracks || []).forEach(function (t) {
        if (t.image) urls[t.image] = 1;
        (t.versions || []).forEach(function (v) { if (v.image) urls[v.image] = 1; });
      });
      (w.versions || []).forEach(function (v) { if (v.image) urls[v.image] = 1; });
    });
    Object.keys(urls).forEach(function (u) { var im = new Image(); im.decoding = 'async'; im.loading = 'eager'; im.src = u; _imgCache.push(im); });
  }

  function boot(json) {
    works = json.works || [];
    logos = json.clientLogos || [];
    state.selected = 0;
    resetSubState(works[0]);
    ensureSelectedVisible();
    preloadAllImages();
    setTimeout(function () { waitForHost(0); }, 1800);
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
    preloadAllImages();
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
