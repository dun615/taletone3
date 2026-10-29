(function () {
  'use strict';

  var scriptUrl = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
  var assetBase = scriptUrl ? new URL('../', scriptUrl).href : 'assets/';
  var root = null;
  var works = [];
  var logos = [];
  var worksMeta = null;
  var liveSiteContent = null;
  var mounted = false;
  var worksDataPromise = null;
  var worksInteractionsBound = false;

  function setMediaStatus(name, value) {
    if (!document.body) return;
    document.body.setAttribute('data-tt-media-' + name, String(value));
  }
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
    if (/^en/i.test(lang)) return 'en';
    try {
      var saved = String(localStorage.getItem('tt_lang') || '').toLowerCase();
      if (saved === 'kr' || saved === 'en' || saved === 'jp') return saved;
    } catch (_e) {}
    return 'kr';
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
  function itemKind(work) {
    var kind = String(work && (work.kind || work.portfolioType || work.itemType || '') || '').toLowerCase();
    if (kind === 'multilingual' || kind === 'single_multilang' || kind === 'single-multilang') return 'single_multilang';
    if (kind === 'ep') return 'ep';
    if (kind === 'album') return 'album';
    if (work && work.tracks && work.tracks.length) return 'album';
    if (work && work.versions && work.versions.length) return 'single_multilang';
    return 'single';
  }
  function titleTrackIndex(work) {
    if (!work || !work.tracks || !work.tracks.length) return 0;
    var fromData = Number(work.titleTrackIndex);
    if (Number.isFinite(fromData) && fromData >= 0 && fromData < work.tracks.length) return fromData;
    var found = work.tracks.findIndex(function (track) { return !!track.isTitle; });
    return found >= 0 ? found : 0;
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
  // ===================================================================
  // WORKS · the record shop
  // Every work is a record in its square sleeve, on a display rack. Pick one and its record goes on the
  // turntable, the tonearm drops and it spins; the deck under it plays, seeks, switches tracks and opens the story in a popup.
  // ===================================================================
  var state = {
    filter: 'all',
    playing: false,
    current: -1,      // index into works of the record being played
    track: 0,
    language: 'KR',
    modal: -1,        // index of the work open in the popup
    settled: false,   // the rack has made its entrance once
    volume: 1,        // linear amplitude, 100 % by default: each record is already brought to the same loudness (below)
    engaged: false,   // the reader has played something
    tab: 'songs',     // songs (곡 제작) | mix (믹싱·마스터링) | arr (편곡·BGM)
    mixShown: 12,     // video cards shown in the mixing tab before "more"
    openAlbums: {},   // phones: albums whose track list is open in the sleeve list
    roles: { produce: true, compose: true, arrange: true, lyrics: true, rec: true, edit: true, mix: true, master: true } // role toggles (any of the on ones)
  };
  var audio = null;

  var shelfLabels = {
    kr: { volume: '볼륨', all: '전체', produce: '프로듀싱', compose: '작곡', arrange: '편곡', lyrics: '작사', rec: '레코딩', edit: '편집', mix: '믹싱', master: '마스터링', instMix: '인스트 믹싱', bgm: 'BGM', piano: '피아노 연주', pianoArr: '피아노 편곡',tabSongs: '음악 제작', tabMix: '사운드 엔지니어링', tabArr: 'ETC', tabs: '작업 종류', game: '게임·애니·웹툰', ownSong: '직접 만든 곡', more: '더 보기', singles: '싱글', album: '앨범', songs: '곡', albumPick: '앨범 재생', ost: 'OST', artist: '버추얼·아티스트', original: '오리지널·기타', play: '재생', pause: '일시정지', detail: '자세히', open: '이야기 펼치기', nowPlaying: '지금 흐르는 노래', close: '닫기', tracks: '트랙', filters: '작업 분류', roleFilter: '참여 역할', mv: 'MV 보기', page: '작업 페이지', credits: '크레딧', covers: '공식 버전 · 커버', listen: '음원 듣기', youtube: 'YouTube에서 보기', video: '영상 재생', pick: '턴테이블에 올리기' },
    en: { volume: 'Volume', all: 'All', produce: 'Production', compose: 'Composition', arrange: 'Arrangement', lyrics: 'Lyrics', rec: 'Recording', edit: 'Editing', mix: 'Mixing', master: 'Mastering', instMix: 'Instrumental Mix', bgm: 'BGM', piano: 'Piano', pianoArr: 'Piano Arrangement',tabSongs: 'Music Production', tabMix: 'Sound Engineering', tabArr: 'ETC', tabs: 'Kinds of work', game: 'Games, Anime & Webtoon', ownSong: 'My own song', more: 'Show more', singles: 'Singles', album: 'Album', songs: 'songs', albumPick: 'Play the album', ost: 'OST', artist: 'Virtual & Artists', original: 'Originals & more', play: 'Play', pause: 'Pause', detail: 'Details', open: 'Open the story', nowPlaying: 'Now playing', close: 'Close', tracks: 'Tracks', filters: 'Work categories', roleFilter: 'My role', mv: 'Watch MV', page: 'Work page', credits: 'Credits', covers: 'Official versions & covers', listen: 'Listen', youtube: 'Watch on YouTube', video: 'Play video', pick: 'Put on the turntable' },
    jp: { volume: '音量', all: 'すべて', produce: 'プロデュース', compose: '作曲', arrange: '編曲', lyrics: '作詞', rec: 'レコーディング', edit: 'エディット', mix: 'ミックス', master: 'マスタリング', instMix: 'インストミックス', bgm: 'BGM', piano: 'ピアノ演奏', pianoArr: 'ピアノ編曲',tabSongs: '音楽制作', tabMix: 'サウンドエンジニアリング', tabArr: 'ETC', tabs: '作品の種類', game: 'ゲーム・アニメ・Webtoon', ownSong: '自作曲', more: 'もっと見る', singles: 'シングル', album: 'アルバム', songs: '曲', albumPick: 'アルバムを再生', ost: 'OST', artist: 'バーチャル・アーティスト', original: 'オリジナル・その他', play: '再生', pause: '一時停止', detail: '詳しく', open: '物語をひらく', nowPlaying: '再生中', close: '閉じる', tracks: 'トラック', filters: '作品の分類', roleFilter: '担当', mv: 'MVを見る', page: '作品ページ', credits: 'クレジット', covers: '公式バージョン・カバー', listen: '音源を聴く', youtube: 'YouTubeで見る', video: '動画を再生', pick: 'ターンテーブルに乗せる' }
  };
  function L() { return shelfLabels[pageLangKey()] || shelfLabels.kr; }

  // Category: an explicit `category` in works-data wins (our own projects are 'original'); otherwise game / animation work is OST
  // and everything else is an artist release.
  function categoryOf(work) {
    if (work && work.category) return String(work.category);
    var text = [work && work.type, work && work.translations && work.translations.en && work.translations.en.type].join(' ');
    return /게임|애니|ANIMATION|Zenless|붕괴|Star ?Rail|OST|주제곡|\bOP\b|game|anime/i.test(text) ? 'ost' : 'artist';
  }
  function isAlbum(work) { var k = itemKind(work); return k === 'album' || k === 'ep'; }
  var FIELD_FILTERS = ['all', 'game', 'artist', 'original'];
  var ROLE_ORDER = ['produce', 'compose', 'arrange', 'lyrics', 'rec', 'edit', 'mix', 'master'];
  var POST_ROLES = { rec: 'Rec', edit: 'Edit', mix: 'Mix', master: 'Master' };
  // the rack is pre-production; recording, editing, mixing and mastering show in Sound Engineering
  var PRE_ROLES = ['produce', 'compose', 'arrange', 'lyrics'];
  // credit words on the video cards (written in English in site-content) → the page language
  var CARD_ROLES = { 'Rec': 'rec', 'Edit': 'edit', 'Mix': 'mix', 'Master': 'master', 'Arr': 'arrange', 'Inst Mix': 'instMix', 'BGM': 'bgm', 'Piano': 'piano', 'Piano Arr': 'pianoArr' };
  function hasRole(unit, role) { return !!(unit && Array.isArray(unit.roles) && unit.roles.indexOf(role) !== -1); }
  function fieldOf(work) { return (work && work.field) || 'artist'; }
  function matchesFilter(work, filter) { return filter === 'all' || fieldOf(work) === filter; }
  // role toggles: with every role of a group on nothing is hidden; otherwise a unit shows when it has any on role
  function rolesAllOn(group) { return group.every(function (role) { return state.roles[role]; }); }
  function matchesRoles(roles, group) {
    return rolesAllOn(group) || group.every(function (role) { return !state.roles[role] || roles.indexOf(role) !== -1; }); // every picked role must be credited
  }
  function cardRoleKeys(text) {
    return String(text || '').split(/\s*·\s*/).map(function (word) { var key = CARD_ROLES[word.replace(/\s*\(.*\)$/, '')]; return key === 'instMix' ? 'mix' : key; }).filter(Boolean);
  }
  function roleChipsHtml(group) {
    var labels = L();
    // every role on reads as "전체" alone; picking a role from there narrows to just that role
    var all = rolesAllOn(group);
    var chip = function (role, on, text) { return '<button type="button" class="tt-role-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-works-action="role" data-role="' + role + '" data-group="' + group[0] + '">' + esc(text) + '</button>'; };
    return '<div class="tt-role-chips" role="group" aria-label="' + esc(labels.roleFilter) + '">' + chip('all', all, labels.all) +
      group.map(function (role) { return chip(role, !all && !!state.roles[role], labels[role]); }).join('') + '</div>';
  }
  // featured records (`pinned`: 1, 2, 3 …) lead in that order; the rest newest first (dates are YYYY.MM.DD, so
  // they sort as text); the data order breaks ties.
  // An entry is a record ({work, index}) or one album track ({work, index, track}).
  function pinRank(work) { var n = Number(work && work.pinned); return n > 0 ? n : Infinity; }
  function entriesFor(filter) {
    var list = works.map(function (work, index) { return { work: work, index: index }; })
      .sort(function (a, b) {
        var pa = pinRank(a.work), pb = pinRank(b.work);
        if (pa !== pb) return pa < pb ? -1 : 1;
        return String(b.work.date || '').localeCompare(String(a.work.date || '')) || a.index - b.index;
      });
    var out = [];
    list.forEach(function (entry) {
      var tracks = isAlbum(entry.work) ? (entry.work.tracks || []) : [];
      if (!matchesFilter(entry.work, filter)) return;
      var roleOk = function (unit) { return matchesRoles((unit && unit.roles) || entry.work.roles || [], PRE_ROLES); };
      if (tracks.length) tracks.forEach(function (track, i) { if (roleOk(track)) out.push({ work: entry.work, index: entry.index, track: i }); });
      else if (roleOk(entry.work)) out.push(entry);
    });
    return out;
  }
  function visibleWorks() { return entriesFor(state.filter); }
  function entryKey(entry) { return entry.track == null ? String(entry.index) : entry.index + '-' + entry.track; }
  // phones get the compact deck and the sideways rack (see works.css "Works on phones")
  function isPhone() { return window.innerWidth <= 760; }
  function shelfStep() {
    if (window.innerWidth <= 1100) return 6;
    return 8;
  }

  function langPrefix() {
    var key = pageLangKey();
    return key === 'en' ? '/en' : key === 'jp' ? '/ja' : '';
  }
  function workHref(work) {
    var base = /^\/preview(\/|$)/.test(location.pathname) ? '/preview' : '';
    return work && work.slug ? base + langPrefix() + '/works/' + encodeURIComponent(work.slug) + '/' : '#c-works';
  }
  function yearOf(work) {
    var match = String((work && work.date) || '').match(/(\d{4})/);
    return match ? match[1] : '';
  }
  function audioUrl(value) {
    return String(value || '').replace(/\\/g, '/');
  }
  function playableUnit(work, trackIndex, language) {
    var variants = variantsFor(work, trackIndex);
    var found = variants.find(function (version, index) { return languageLabel(version, index) === language; });
    return found || variants[0] || {};
  }
  function hasAudio(work) {
    if (!work) return false;
    if (work.audio) return true;
    if ((work.tracks || []).some(function (t) { return t.audio || (t.versions || []).some(function (v) { return v.audio; }); })) return true;
    return (work.versions || []).some(function (v) { return v.audio; });
  }

  // CSS resolves url() inside a custom property against the stylesheet that uses it, so pass a root path
  function rootUrl(value) {
    var v = String(value || '').replace(/\\/g, '/');
    return /^(?:[a-z]+:|\/)/i.test(v) ? v : '/' + v;
  }

  function coverStyle(unit) {
    var fit = unit.fit === 'contain' ? 'contain' : 'cover';
    var pos = (unit.posX || '50%') + ' ' + (unit.posY || '50%');
    return 'object-fit:' + fit + ';object-position:' + esc(pos);
  }
  function playButton(index, title, extraClass) {
    var labels = L(), on = state.current === index && state.playing;
    return '<button type="button" class="tt-shelf-play' + (extraClass ? ' ' + extraClass : '') + (on ? ' is-playing' : '') + '" data-works-action="play" data-index="' + index + '" aria-label="' + esc((on ? labels.pause : labels.play) + ': ' + title) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span><span class="tt-shelf-eq" aria-hidden="true"><i></i><i></i><i></i></span></button>';
  }

  function tabsHtml() {
    var labels = L();
    return '<div class="tt-works-tabs" role="tablist" aria-label="' + esc(labels.tabs) + '">' + [['songs', labels.tabSongs], ['mix', labels.tabMix], ['arr', labels.tabArr]].map(function (tab) {
      var on = state.tab === tab[0];
      return '<button type="button" role="tab" class="tt-works-tab' + (on ? ' is-on' : '') + '" aria-selected="' + on + '" data-works-action="tab" data-tab="' + tab[0] + '">' + esc(tab[1]) + '</button>';
    }).join('') + '</div>';
  }
  function filtersHtml() {
    var labels = L();
    return '<div class="tt-shelf-filters" role="group" aria-label="' + esc(labels.filters) + '">' + FIELD_FILTERS.map(function (key) {
      var count = entriesFor(key).length;
      var on = state.filter === key;
      if (!count && !on) return '';
      return '<button type="button" class="tt-shelf-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-works-action="filter" data-filter="' + key + '">' + esc(labels[key]) + '<span class="tt-shelf-chip-count">' + count + '</span></button>';
    }).join('') + '</div>' + roleChipsHtml(PRE_ROLES);
  }

  // ---- a record: the cover art pressed into a picture disc; it spins while it plays ----
  function discHtml(work, extraClass, eager) {
    var unit = localizedUnit(work);
    var image = unit.image || work.image || '';
    return '<span class="tt-disc' + (extraClass ? ' ' + extraClass : '') + '" aria-hidden="true">' +
      '<span class="tt-disc-spin"><img ' + (eager === false ? 'data-src' : 'src') + '="' + esc(image) + '" alt="" loading="lazy" decoding="async" style="' + coverStyle(unit) + '"></span>' +
      '<span class="tt-disc-sheen"></span><span class="tt-disc-hole"></span></span>';
  }

  // a record sleeve: the square cover art, from its small `thumb` copy when there is one
  function sleeveHtml(work, eager) {
    var unit = localizedUnit(work);
    var image = unit.image && unit.image !== work.image ? unit.image : (work.thumb || work.image || '');
    // the first rows load at once (Works mounts on demand, often after the chapter preload already ran, so
    // native lazy loading would leave them unfetched while the sleeve is still off screen); the rest wait for
    // the rack's own observer
    return '<span class="tt-sleeve" aria-hidden="true"><img ' + (eager === false ? 'data-src' : 'src') + '="' + esc(image) + '" alt="" loading="' + (eager === false ? 'lazy' : 'eager') + '" decoding="async" style="' + coverStyle(unit) + '"><span class="tt-sleeve-sheen"></span></span>';
  }

  // the sleeve that holds the rack's single Tab stop: the record on the deck, or the first one
  function rackFocusOrder() {
    var list = visibleWorks();
    for (var i = 0; i < list.length; i++) if (list[i].index === state.current && (list[i].track == null || list[i].track === state.track)) return i;
    return 0;
  }
  function onRackKey(event) {
    var pick = event.target && event.target.closest ? event.target.closest('.tt-rack-pick') : null;
    if (!pick || !root || !root.contains(pick)) return;
    var picks = Array.prototype.slice.call(root.querySelectorAll('.tt-rack-pick'));
    var at = picks.indexOf(pick);
    var grid = pick.closest('.tt-shelf-row') || root.querySelector('.tt-rack-grid');
    var columnFlow = grid && getComputedStyle(grid).gridAutoFlow.indexOf('column') === 0;
    var rows = columnFlow ? getComputedStyle(grid).gridTemplateRows.split(' ').length : 1;
    var cols = grid && !columnFlow ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 4;
    var next = (columnFlow
      ? { ArrowRight: at + rows, ArrowLeft: at - rows, ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: picks.length - 1 }
      : { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + cols, ArrowUp: at - cols, Home: 0, End: picks.length - 1 })[event.key];
    if (next == null) return;
    event.preventDefault();
    next = Math.max(0, Math.min(picks.length - 1, next));
    pick.setAttribute('tabindex', '-1');
    picks[next].setAttribute('tabindex', '0');
    picks[next].focus();
    picks[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function trackItemHtml(entry, order) {
    var work = entry.work, index = entry.index, labels = L();
    var track = work.tracks[entry.track] || {};
    var unit = localizedUnit(track), album = localizedUnit(work);
    var title = plainRichText(unit.title || track.title || '');
    var from = rolesText(track);
    var image = unit.image || track.image || work.thumb || work.image || '';
    var current = state.current === index && state.track === entry.track;
    var no = String(entry.track + 1).padStart(2, '0');
    var cls = 'tt-rack-item is-track' + (isPhone() ? ' tt-m-card' : '') + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '');
    var pickButton = '<button type="button" class="tt-rack-pick" data-works-action="pick" data-index="' + index + '" data-track="' + entry.track + '" tabindex="' + (order === rackFocusOrder() ? '0' : '-1') + '" title="' + esc(title) + '" aria-label="' + esc(title + ' — ' + labels.pick) + '">';
    var art = '<img ' + (order < 8 ? 'src' : 'data-src') + '="' + esc(image) + '" alt="" loading="' + (order < 8 ? 'eager' : 'lazy') + '" decoding="async" style="' + coverStyle(unit) + '">';
    if (isPhone()) {
      return '<li class="' + cls + '" data-works-book="' + entryKey(entry) + '">' + pickButton +
          '<span class="tt-m-card-art">' + art + '<span class="tt-rack-trackno" aria-hidden="true">' + no + '</span><span class="tt-rack-badge" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
          '<span class="tt-rack-name">' + esc(title) + '</span>' + (from ? '<span class="tt-rack-artist tt-rack-roles">' + esc(from) + '</span>' : '') +
        '</button></li>';
    }
    return '<li class="' + cls + '" data-works-book="' + entryKey(entry) + '" style="--i:' + order + '">' + pickButton +
        '<span class="tt-sleeve" aria-hidden="true">' + art + '<span class="tt-sleeve-sheen"></span></span>' +
        '<span class="tt-rack-trackno" aria-hidden="true">' + no + '</span>' +
        '<span class="tt-rack-badge" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '</button>' +
      '<div class="tt-rack-meta"><h3 class="tt-rack-name">' + esc(title) + '</h3>' + (from ? '<p class="tt-rack-artist tt-rack-roles">' + esc(from) + '</p>' : '') + '</div>' +
    '</li>';
  }
  function rolesText(unit) {
    var labels = L();
    var roles = unit && Array.isArray(unit.roles) ? unit.roles : [];
    return PRE_ROLES.filter(function (role) { return roles.indexOf(role) !== -1; }).map(function (role) { return labels[role]; }).join(' · '); // a wrapped line never starts with the dot
  }
  function cardRolesText(text) {
    var labels = L();
    // a role can carry a note in parentheses, kept as written: 'Rec (Eryn)' → 녹음 (Eryn)
    return String(text || '').split(/\s*·\s*/).filter(Boolean).map(function (word) {
      var m = word.match(/^(.*?)(\s*\(.*\))?$/);
      return (labels[CARD_ROLES[m[1]]] || m[1]) + (m[2] || '');
    }).join(' · ');
  }
  function rackItemHtml(entry, order) {
    if (entry.track != null) return trackItemHtml(entry, order);
    var work = entry.work, index = entry.index, labels = L();
    var unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var artist = plainRichText(unit.artist || work.artist || '');
    var current = state.current === index;
    var pin = pinRank(work) < Infinity ? '<span class="tt-rack-trackno" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5a3 3 0 0 1-3 3v2h5.97v7l1 1 1-1v-7H19v-2a3 3 0 0 1-3-3z"/></svg></span>' : '';
    if (isPhone()) {
      var thumb = unit.image && unit.image !== work.image ? unit.image : (work.thumb || work.image || '');
      return '<li class="tt-rack-item tt-m-card' + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '') + '" data-works-book="' + index + '">' +
        '<button type="button" class="tt-rack-pick" data-works-action="pick" data-index="' + index + '" tabindex="' + (order === rackFocusOrder() ? '0' : '-1') + '" aria-label="' + esc(title + ' — ' + labels.pick) + '">' +
          '<span class="tt-m-card-art"><img ' + (order < 4 ? 'src' : 'data-src') + '="' + esc(thumb) + '" alt="" decoding="async" style="' + coverStyle(unit) + '">' +
            pin + '<span class="tt-rack-badge" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
          '<span class="tt-rack-name">' + esc(title) + '</span><span class="tt-rack-artist">' + esc(artist) + '</span>' + (rolesText(work) ? '<span class="tt-rack-artist tt-rack-roles">' + esc(rolesText(work)) + '</span>' : '') +
        '</button>' +
      '</li>';
    }
    return '<li class="tt-rack-item' + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '') + '" data-works-book="' + index + '" style="--i:' + order + '">' +
      '<button type="button" class="tt-rack-pick" data-works-action="pick" data-index="' + index + '" tabindex="' + (order === rackFocusOrder() ? '0' : '-1') + '" title="' + esc(title + (artist ? ' — ' + artist : '')) + '" aria-label="' + esc(title + ' — ' + labels.pick) + '">' +
        sleeveHtml(work, order < 8) + pin +
        '<span class="tt-rack-badge" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '</button>' +
      '<div class="tt-rack-meta"><h3 class="tt-rack-name">' + esc(title) + '</h3>' + (artist ? '<p class="tt-rack-artist">' + esc(artist) + '</p>' : '') + (rolesText(work) ? '<p class="tt-rack-artist tt-rack-roles">' + esc(rolesText(work)) + '</p>' : '') + '</div>' +
    '</li>';
  }

  // ---- the turntable: the chosen record on the platter, the tonearm, and everything to play it ----
  function deckHtml() {
    var labels = L();
    var work = works[state.current];
    if (!work) return '';
    var unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var trackTitle = work.tracks && work.tracks.length > 1 ? plainRichText(localizedUnit(work.tracks[state.track]).title || '') : '';
    var variants = variantsFor(work, state.track);
    var tracks = work.tracks && work.tracks.length > 1
      ? '<div class="tt-deck-chips" role="group" aria-label="' + esc(labels.tracks) + '">' + work.tracks.map(function (track, i) {
          return '<button type="button" class="' + (i === state.track ? 'is-on' : '') + '" aria-pressed="' + (i === state.track) + '" data-works-action="track" data-track="' + i + '" title="' + esc(plainRichText(localizedUnit(track).title || '')) + '">' + pad(i + 1) + '</button>';
        }).join('') + '</div>' : '';
    var langs = variants.length > 1
      ? '<div class="tt-deck-chips" role="group">' + variants.map(function (version, i) {
          var label = languageLabel(version, i);
          return '<button type="button" class="' + (label === state.language ? 'is-on' : '') + '" aria-pressed="' + (label === state.language) + '" data-works-action="language" data-language="' + esc(label) + '">' + esc(label) + '</button>';
        }).join('') + '</div>' : '';
    var moreButton = '<button type="button" class="tt-deck-more" data-works-action="open" data-index="' + state.current + '">' + esc(labels.detail) + ' <span aria-hidden="true">+</span></button>';
    if (isPhone()) {
      var thumbNow = unit.image && unit.image !== work.image ? unit.image : (work.thumb || work.image || '');
      return '<section class="tt-deck tt-m-now' + (state.playing ? ' is-playing' : '') + '" aria-label="' + esc(labels.nowPlaying) + '">' +
        '<div class="tt-m-now-main">' +
          '<span class="tt-m-now-art"><img src="' + esc(thumbNow) + '" alt="" decoding="async" style="' + coverStyle(unit) + '"><span class="tt-m-now-eq" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
          '<div class="tt-deck-info tt-m-now-info">' +
            '<p class="tt-shelf-format">' + esc([work.format || (isAlbum(work) ? 'Album' : 'Single'), yearOf(work)].filter(Boolean).join(' · ')) + '</p>' +
            '<h3 class="tt-deck-title">' + esc(title) + '</h3>' +
            '<p class="tt-deck-artist">' + esc(plainRichText(unit.artist || work.artist || '')) + (trackTitle ? ' · <span>' + esc(trackTitle) + '</span>' : '') + '</p>' +
          '</div>' +
          // play/pause with "자세히 +" under it: the info lines stay clean and a single needs no extra row
          '<div class="tt-m-now-side">' +
            (hasAudio(work)
              ? '<button type="button" class="tt-deck-toggle tt-m-now-play' + (state.playing ? ' is-playing' : '') + '" data-works-action="toggle" aria-label="' + esc((state.playing ? labels.pause : labels.play) + ': ' + title) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span></button>'
              : '') +
            moreButton +
          '</div>' +
        '</div>' +
        (tracks || langs ? '<div class="tt-m-now-actions">' + tracks + langs + '</div>' : '') +
        (unit.description ? '<p class="tt-deck-story">' + esc(plainRichText(unit.description)) + '</p>' : '') +
      '</section>';
    }
    return '<section class="tt-deck' + (state.playing ? ' is-playing' : '') + '" aria-label="' + esc(labels.nowPlaying) + '">' +
      '<div class="tt-deck-table">' +
        '<div class="tt-deck-platter">' + discHtml(work, 'tt-disc--platter') + '<span class="tt-deck-spindle"></span></div>' +
        '<div class="tt-deck-arm" aria-hidden="true"><i class="tt-deck-arm-bar"></i><i class="tt-deck-arm-head"></i></div>' +
        (hasAudio(work)
          ? '<button type="button" class="tt-deck-arm-base tt-deck-toggle' + (state.playing ? ' is-playing' : '') + '" data-works-action="toggle" aria-label="' + esc((state.playing ? labels.pause : labels.play) + ': ' + title) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span></button>'
          : '<span class="tt-deck-arm-base" aria-hidden="true"></span>') +
        '<label class="tt-deck-volume"><span class="tt-sr-only">' + esc(labels.volume) + '</span><input type="range" min="0" max="100" step="1" value="' + Math.round(state.volume * 100) + '" data-works-volume aria-valuetext="' + esc(volumeText(state.volume)) + '" style="--v:' + state.volume + '"></label>' +
        moreButton +
        '<span class="tt-deck-led" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="tt-deck-info">' +
        '<p class="tt-shelf-format">' + esc([work.format || (isAlbum(work) ? 'Album' : 'Single'), yearOf(work)].filter(Boolean).join(' · ')) + '</p>' +
        '<h3 class="tt-deck-title">' + esc(title) + '</h3>' +
        '<p class="tt-deck-artist">' + esc(plainRichText(unit.artist || work.artist || '')) + (trackTitle ? ' · <span>' + esc(trackTitle) + '</span>' : '') + '</p>' +
        (unit.description ? '<p class="tt-deck-story">' + esc(plainRichText(unit.description)) + '</p>' : '') +
        tracks + langs +
      '</div>' +
    '</section>';
  }

  function trackRowsHtml(work, index) {
    if (!work.tracks || work.tracks.length < 2) return '';
    var labels = L();
    return '<div class="tt-shelf-modal-tracks"><p class="tt-shelf-modal-label">' + esc(labels.tracks) + '</p><ol>' + work.tracks.map(function (track, i) {
      var t = localizedUnit(track), on = state.current === index && state.track === i;
      return '<li><button type="button" class="' + (on ? 'is-on' : '') + '" data-works-action="modal-track" data-index="' + index + '" data-track="' + i + '"><span>' + pad(i + 1) + '</span>' + esc(plainRichText(t.title || '')) + '</button></li>';
    }).join('') + '</ol></div>';
  }

  function youtubeId(url) {
    var m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
  var closeIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  function listenButton(index) {
    var labels = L(), on = state.current === index && state.playing;
    return '<button type="button" class="tt-shelf-listen' + (on ? ' is-playing' : '') + '" data-works-action="play" data-index="' + index + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span><span class="tt-shelf-listen-label">' + esc(on ? labels.pause : labels.listen) + '</span></button>';
  }

  // Credits keep their own wording; blank lines split them into groups, and "[Music Credits]" or
  // "1. Song" lines head a group. The block scrolls inside the popup when it is long.
  function creditsHtml(text, label) {
    var groups = text.replace(/\r/g, '').split(/\n\s*\n/).map(function (group) {
      return group.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
        var head = /^\[.+\]$/.test(line) || /^\d+\.\s/.test(line);
        return head ? '<strong>' + esc(line.replace(/^\[|\]$/g, '')) + '</strong>' : '<span>' + esc(line) + '</span>';
      }).join('');
    }).filter(Boolean);
    return '<section class="tt-shelf-modal-credits" aria-label="' + esc(label) + '">' +
      '<p class="tt-shelf-modal-label">' + esc(label) + '</p>' +
      '<div class="tt-shelf-modal-credits-list" tabindex="0"><div>' + groups.map(function (g) { return '<p>' + g + '</p>'; }).join('') + '</div></div>' +
    '</section>';
  }

  // An album shows the credits of one track at a time: the one playing, else its title track. The heading
  // names the track; picking another track in the popup switches them (refreshPlaying). Language versions
  // of a single keep the work's own credits.
  function shownTrack(work, index) { return state.current === index ? state.track : titleTrackIndex(work); }
  // the popup's video follows the same track; a track without its own video shows the album's
  function videoFor(work, index) {
    var track = work.tracks && work.tracks.length > 1 ? work.tracks[shownTrack(work, index)] : null;
    return youtubeId((track && track.youtube) || work.youtube);
  }
  function creditsFor(work, index) {
    var unit = localizedUnit(work), labels = L();
    if (work.tracks && work.tracks.length > 1) {
      var i = shownTrack(work, index);
      var track = localizedUnit(work.tracks[i] || {});
      return { text: String(track.credits || unit.credits || work.credits || '').trim(), label: labels.credits + ' · ' + pad(i + 1) + ' ' + plainRichText(track.title || '') };
    }
    return { text: String(unit.credits || work.credits || '').trim(), label: labels.credits };
  }

  function modalHtml(index) {
    var work = works[index]; if (!work) return '';
    var labels = L(), meta = localizedMeta();
    var unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var image = unit.image || work.image || '';
    var credit = creditsFor(work, index);
    var id = videoFor(work, index);
    var facts = [[meta.yearLabel, unit.date || work.date], [meta.typeLabel, work.format], [meta.releaseLabel, plainRichText(unit.type || work.type || '')]]
      .filter(function (row) { return row[1]; })
      .map(function (row) { return '<div><dt>' + esc(plainRichText(row[0] || '')) + '</dt><dd>' + esc(row[1]) + '</dd></div>'; }).join('');
    var stage = id
      ? '<div class="tt-shelf-yt" data-yt="' + id + '"><img src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="" onload="if(this.naturalWidth<200)this.src=\'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg\'">' +
        '<button type="button" class="tt-shelf-yt-play" data-works-action="video" aria-label="' + esc(title + ' — ' + labels.video) + '"><span aria-hidden="true"></span></button></div>'
      : '<div class="tt-shelf-modal-art' + (state.current === index && state.playing ? ' is-playing' : '') + '"><span class="tt-shelf-disc" aria-hidden="true" style="--art:url(\'' + esc(rootUrl(image)) + '\')"><i></i></span><img src="' + esc(image) + '" alt="" style="' + coverStyle(unit) + '">' + (hasAudio(work) ? playButton(index, title, 'tt-shelf-modal-play') : '') + '</div>';
    var links = (hasAudio(work) ? listenButton(index) : '') +
      '<a class="tt-shelf-modal-link" href="' + esc(workHref(work)) + '">' + esc(labels.page) + ' <span aria-hidden="true">→</span></a>';
    return '<div class="tt-shelf-modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" data-works-action="close-backdrop">' +
      '<div class="tt-shelf-modal-panel">' +
        '<button type="button" class="tt-shelf-modal-close" data-works-action="close" aria-label="' + esc(labels.close) + '">' + closeIcon + '</button>' +
        // two panes: the video and the story on the left, the record's facts, tracks and credits on the right
        '<div class="tt-shelf-modal-media">' +
          '<div class="tt-shelf-modal-stage">' + stage + '</div>' +
          '<div class="tt-shelf-modal-main">' +
            '<p class="tt-shelf-format">' + esc([work.format, yearOf(work)].filter(Boolean).join(' · ')) + '</p>' +
            '<h3 class="tt-shelf-modal-title">' + esc(title) + '</h3>' +
            '<p class="tt-shelf-modal-artist">' + esc(plainRichText(unit.artist || work.artist || '')) + '</p>' +
            (unit.description ? '<p class="tt-shelf-modal-story">' + esc(plainRichText(unit.description)) + '</p>' : '') +
            '<div class="tt-shelf-modal-links">' + links + '</div>' +
            coversHtml(work) +
          '</div>' +
        '</div>' +
        '<div class="tt-shelf-modal-info">' +
          (facts ? '<dl class="tt-shelf-modal-facts">' + facts + '</dl>' : '') +
          trackRowsHtml(work, index) +
          (credit.text ? creditsHtml(credit.text, credit.label) : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // official covers of the song (the client's own promotion): small videos under the record's story
  function coversHtml(work) {
    var list = Array.isArray(work.officialCovers) ? work.officialCovers.filter(function (c) { return c && c.youtube; }) : [];
    if (!list.length) return '';
    var labels = L(), lang = pageLangKey();
    return '<section class="tt-shelf-covers" aria-label="' + esc(labels.covers) + '"><h4 class="tt-shelf-covers-title">' + esc(labels.covers) + '</h4><ul>' +
      list.map(function (c) {
        var who = (lang === 'en' && c.artistEn) || (lang === 'jp' && c.artistJp) || c.artist || '';
        return '<li><div class="tt-shelf-yt" data-yt="' + esc(c.youtube) + '"><img src="https://i.ytimg.com/vi/' + esc(c.youtube) + '/hqdefault.jpg" alt="" loading="lazy" decoding="async">' +
          '<button type="button" class="tt-shelf-yt-play" data-works-action="video" aria-label="' + esc(who + ' — ' + labels.video) + '"><span aria-hidden="true"></span></button></div>' +
          '<p>' + esc(who) + '</p></li>';
      }).join('') + '</ul></section>';
  }

  function headHtml() {
    var meta = localizedMeta();
    var content = liveSiteContent || window.TALETONE_CONTENT || {};
    var chapter = content.chapterLabels || {};
    var music = Object.assign({}, chapter.music || {}, (chapter.translations && chapter.translations[pageLangKey()] && chapter.translations[pageLangKey()].music) || {});
    return '<header class="tt-shelf-head">' +
      '<div class="tt-section-chapter">' + preserve(music.label || meta.eyebrow) + '</div>' +
      (music.note ? '<div class="tt-section-note">' + esc(music.note) + '</div>' : '') +
      '<h2 class="tt-shelf-title">' + preserve(meta.title) + ' <span>' + preserve(meta.titleAccent) + '</span></h2>' +
      (meta.historyLabel ? '<button type="button" class="tt-shelf-history" data-works-action="history">' + esc(meta.historyLabel) + ' <span aria-hidden="true">&#8594;</span></button>' : '') +
    '</header>';
  }

  function clientsHtml() {
    if (!logos.length) return '';
    var meta = localizedMeta();
    return '<div class="tt-shelf-clients"><span class="tt-shelf-clients-label">' + esc(plainRichText(meta.collaborationLabel)) + '</span><div class="tt-shelf-clients-row">' +
      // the pixel size reserves each logo's width before the lazy image arrives, so the row never rewraps late
      logos.map(function (logo) { return '<img src="' + esc(logo.src) + '" alt="' + esc(logo.alt) + '"' + (logo.width && logo.height ? ' width="' + logo.width + '" height="' + logo.height + '"' : '') + ' loading="lazy">'; }).join('') + '</div></div>';
  }

  // engineering, arrangement and BGM credits: watched on YouTube (or heard from a small player), not pressed as records
  // my own songs where I also recorded, edited, mixed or mastered, as video cards for the mixing tab
  function ownPostItems() {
    var out = [];
    works.forEach(function (work) {
      var album = localizedUnit(work);
      (isAlbum(work) && work.tracks && work.tracks.length ? work.tracks : [work]).forEach(function (unit) {
        var post = Object.keys(POST_ROLES).filter(function (role) { return hasRole(unit, role); });
        var id = youtubeId(unit.youtube || (unit === work ? work.youtube : ''));
        // a record without a video shows as an audio card
        if (!post.length || !(id || unit.audio)) return;
        var u = localizedUnit(unit);
        out.push({ title: plainRichText(u.title || unit.title || ''), artist: plainRichText(album.artist || work.artist || ''), roles: post.map(function (role) { return POST_ROLES[role]; }).join(' · '),
          youtube: id || undefined, audio: id ? undefined : unit.audio, date: String(unit.date || work.date || '').replace(/\./g, '-'), own: true });
      });
    });
    return out;
  }
  // ETC cards that also credit recording, editing, mixing or mastering show in Sound Engineering too
  function etcPostItems() {
    var content = liveSiteContent || window.TALETONE_CONTENT || {};
    var post = Object.keys(POST_ROLES);
    return ((content.bgmWorks && content.bgmWorks.items) || []).filter(function (it) {
      return cardRoleKeys(it && it.roles).some(function (key) { return post.indexOf(key) !== -1; });
    });
  }
  // the day a card's video went up on YouTube (KST); a card without a video keeps its own date
  function cardDate(it, content) {
    var dates = content.videoDates || {};
    return String((it.youtube && dates[it.youtube]) || it.date || '');
  }
  function cardDateText(date) {
    var m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(date);
    if (pageLangKey() === 'en') return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
    return m[1] + '.' + m[2] + '.' + m[3];
  }
  function tabHeadHtml(key) {
    var content = liveSiteContent || window.TALETONE_CONTENT || {};
    var head = content[key] || {};
    var t = Object.assign({}, head, (head.translations && head.translations[pageLangKey()]) || {});
    if (!t.label && !t.note) return '';
    return '<div class="tt-mix-head tt-tab-head"><span class="tt-mix-label">' + esc(t.label || '') + '</span>' + (t.note ? '<span class="tt-mix-note">' + esc(t.note) + '</span>' : '') + '</div>';
  }
  function mixHtml(key, extra, paged, roleGroup) {
    var content = liveSiteContent || window.TALETONE_CONTENT || {};
    var mix = content[key] || {};
    var seen = {};
    var items = (Array.isArray(mix.items) ? mix.items : []).concat(extra || []).filter(function (it) {
      if (!it || !(it.youtube || it.audio)) return false;
      var k = it.youtube || it.audio; if (seen[k]) return false; seen[k] = true; return true;
    });
    if (roleGroup) items = items.filter(function (it) { return matchesRoles(cardRoleKeys(it.roles), roleGroup); });
    items.forEach(function (it) { it.shown = cardDate(it, content); });
    items.sort(function (x, y) { return y.shown.localeCompare(x.shown); }); // newest first
    var total = items.length;
    if (paged) items = items.slice(0, state.mixShown);
    if (!items.length && !roleGroup) return '';
    var t = Object.assign({}, mix, (mix.translations && mix.translations[pageLangKey()]) || {});
    var lang = pageLangKey();
    return '<section class="tt-mix" aria-label="' + esc(t.label || '') + '">' +
      '<div class="tt-mix-head"><span class="tt-mix-label">' + esc(t.label || '') + '</span>' + (t.note ? '<span class="tt-mix-note">' + esc(t.note) + '</span>' : '') + '</div>' +
      (roleGroup ? roleChipsHtml(roleGroup) : '') +
      '<ul class="tt-mix-row tt-mix-grid">' + items.map(function (it) {
        var title = (lang === 'en' && it.titleEn) || (lang === 'jp' && it.titleJp) || it.title;
        var media = it.youtube
          ? '<div class="tt-shelf-yt" data-yt="' + esc(String(it.youtube)) + '"><img src="https://i.ytimg.com/vi/' + esc(String(it.youtube)) + '/hqdefault.jpg" alt="" loading="lazy" decoding="async">' +
            '<button type="button" class="tt-shelf-yt-play" data-works-action="video" aria-label="' + esc(title + ' — ' + it.artist) + '"><span aria-hidden="true"></span></button></div>'
          : '<div class="tt-mix-audio"><span class="tt-mix-audio-tag" aria-hidden="true">' + esc(cardRolesText(it.roles)) + '</span>' +
            '<audio controls preload="none" src="' + esc(audioUrl(it.audio)) + '" data-gain="' + loudnessGain(it.audio) + '" aria-label="' + esc(title) + '"></audio></div>';
        return '<li class="tt-mix-card">' + media +
          '<div class="tt-mix-copy"><strong>' + esc(title) + '</strong><span>' + esc(it.artist) + (it.cover ? ' · ' + esc(t.coverTag || 'Cover') : '') + (it.own ? ' · ' + esc(L().ownSong) : '') + '</span><small>' + esc(cardRolesText(it.roles)).replace(/\(([^)]*)\)/g, '(<i>$1</i>)') + '</small>' +
          (it.shown ? '<time class="tt-mix-date" datetime="' + esc(it.shown) + '">' + esc(cardDateText(it.shown)) + '</time>' : '') + '</div>' +
        '</li>';
      }).join('') + '</ul>' +
      (paged && total > items.length ? '<button type="button" class="tt-mix-more" data-works-action="more">' + esc(L().more) + ' <span>' + (total - items.length) + '</span></button>' : '') +
      '</section>';
  }

  document.addEventListener('play', function (event) {
    var el = event.target;
    if (!el || el.tagName !== 'AUDIO' || !el.closest || !el.closest('.tt-mix-audio')) return;
    pauseAll();
    var gain = Number(el.getAttribute('data-gain'));
    if (isFinite(gain) && gain > 0) el.volume = Math.min(1, gain);
    document.querySelectorAll('.tt-mix-audio audio').forEach(function (other) { if (other !== el && !other.paused) other.pause(); });
  }, true);

  function bookRects() {
    var rects = {};
    if (!root) return rects;
    root.querySelectorAll('[data-works-book]').forEach(function (book) { rects[book.getAttribute('data-works-book')] = book.getBoundingClientRect(); });
    return rects;
  }
  // books that stay glide to their new places; books that arrive grow in (FLIP)
  function shuffleFrom(before) {
    if (!root || !before) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    root.querySelectorAll('[data-works-book]').forEach(function (book, i) {
      var was = before[book.getAttribute('data-works-book')], now = book.getBoundingClientRect();
      book.style.transition = 'none';
      if (was) book.style.transform = 'translate(' + (was.left - now.left).toFixed(1) + 'px,' + (was.top - now.top).toFixed(1) + 'px)';
      else { book.style.transform = 'scale(.86)'; book.style.opacity = '0'; }
      book.style.transitionDelay = (was ? 0 : Math.min(i, 10) * 30) + 'ms';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.querySelectorAll('[data-works-book]').forEach(function (book) {
          book.style.transition = 'transform .55s cubic-bezier(.2,.75,.2,1), opacity .45s ease';
          book.style.transform = '';
          book.style.opacity = '';
        });
      });
    });
  }

  // phones: one column of record sleeves, each with its picture disc peeking out, so the page only scrolls down.
  // An album is a single sleeve that opens its track list in place (state.openAlbums).
  function sleeveListHtml(blocks) {
    var labels = L(), order = 0;
    var eager = function () { return order < 6; };
    var img = function (src, unit) { var now = eager(); return '<img ' + (now ? 'src' : 'data-src') + '="' + esc(src) + '" alt="" loading="' + (now ? 'eager' : 'lazy') + '" decoding="async" style="' + coverStyle(unit) + '">'; };
    var tabindex = function () { return order === rackFocusOrder() ? '0' : '-1'; };
    var pinIcon = '<span class="tt-sl-pin" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5a3 3 0 0 1-3 3v2h5.97v7l1 1 1-1v-7H19v-2a3 3 0 0 1-3-3z"/></svg></span>';
    var single = function (entry) {
      var work = entry.work, index = entry.index, unit = localizedUnit(work);
      var title = plainRichText(unit.title || work.title || ''), artist = plainRichText(unit.artist || work.artist || '');
      var thumb = unit.image && unit.image !== work.image ? unit.image : (work.thumb || work.image || '');
      var meta = [rolesText(work), yearOf(work)].filter(Boolean).join(' · ');
      var current = state.current === index;
      var html = '<li class="tt-rack-item tt-sl-row' + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '') + '" data-works-book="' + index + '">' +
        '<button type="button" class="tt-rack-pick tt-sl-pick" data-works-action="pick" data-index="' + index + '" tabindex="' + tabindex() + '" aria-label="' + esc(title + ' — ' + labels.pick) + '">' +
          '<span class="tt-sl-art"><span class="tt-sl-disc" aria-hidden="true" style="--art:url(\'' + esc(rootUrl(thumb)) + '\')"><i></i></span>' + img(thumb, unit) + (pinRank(work) < Infinity ? pinIcon : '') + '</span>' +
          '<span class="tt-sl-text"><span class="tt-rack-name">' + esc(title) + '</span><span class="tt-rack-artist">' + esc(artist) + '</span>' + (meta ? '<span class="tt-rack-roles">' + esc(meta) + '</span>' : '') + '</span>' +
          '<span class="tt-sl-play" aria-hidden="true"><span class="tt-rack-badge"><i></i><i></i><i></i></span></span>' +
        '</button></li>';
      order++;
      return html;
    };
    var album = function (block) {
      var work = works[block.index], index = block.index, unit = localizedUnit(work);
      var name = plainRichText(String(unit.title || work.title || '').replace(/\s*\[ALBUM\]\s*$/i, ''));
      var artist = plainRichText(unit.artist || work.artist || '');
      var total = (work.tracks || []).length, shown = block.entries.length;
      var open = !!state.openAlbums[index];
      var thumb = work.thumb || work.image || '';
      var count = (shown !== total ? shown + ' / ' : '') + total + (pageLangKey() === 'en' ? ' ' : '') + labels.songs;
      var head = '<button type="button" class="tt-sl-pick tt-sl-album-head" data-works-action="album" data-index="' + index + '" tabindex="' + tabindex() + '" aria-expanded="' + open + '" aria-controls="tt-sl-tracks-' + index + '">' +
          '<span class="tt-sl-art is-stack">' + img(thumb, unit) + '</span>' +
          '<span class="tt-sl-text"><span class="tt-rack-name">' + esc(name) + '</span><span class="tt-rack-artist">' + esc(artist) + '</span><span class="tt-rack-roles">' + esc(labels.album) + ' · ' + esc(count) + ' · ' + esc(yearOf(work)) + '</span></span>' +
          '<span class="tt-sl-chevron" aria-hidden="true"></span>' +
        '</button>';
      order++;
      var tracks = open ? '<ol class="tt-sl-tracks" id="tt-sl-tracks-' + index + '">' + block.entries.map(function (entry) {
        var track = work.tracks[entry.track] || {}, title = plainRichText(localizedUnit(track).title || track.title || '');
        var current = state.current === index && state.track === entry.track;
        return '<li class="tt-rack-item tt-sl-track' + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '') + '" data-works-book="' + entryKey(entry) + '">' +
          '<button type="button" class="tt-rack-pick tt-sl-track-pick" data-works-action="pick" data-index="' + index + '" data-track="' + entry.track + '" tabindex="-1" aria-label="' + esc(title + ' — ' + labels.pick) + '">' +
            '<span class="tt-sl-no">' + pad(entry.track + 1) + '</span>' +
            '<span class="tt-sl-text"><span class="tt-rack-name">' + esc(title) + '</span>' + (rolesText(track) ? '<span class="tt-rack-roles">' + esc(rolesText(track)) + '</span>' : '') + '</span>' +
            '<span class="tt-sl-play" aria-hidden="true"><span class="tt-rack-badge"><i></i><i></i><i></i></span></span>' +
          '</button></li>';
      }).join('') + '</ol>' : '';
      var current = state.current === index;
      return '<li class="tt-sl-album' + (open ? ' is-open' : '') + (current ? ' is-current' : '') + '" data-works-book="' + index + '">' + head + tracks + '</li>';
    };
    return '<div class="tt-rack-grid tt-sl-list"><ul class="tt-sl">' + blocks.map(function (block) {
      return block.kind === 'singles' ? block.entries.map(single).join('') : album(block);
    }).join('') + '</ul></div>';
  }

  // phones: once something has played, a small player floats above the dock whenever the turntable card has
  // scrolled out of view inside Works (syncMini); tapping the title brings the turntable back
  function miniHtml() {
    var work = works[state.current];
    if (!isPhone() || !work || !state.engaged) return '';
    var labels = L(), unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var track = work.tracks && work.tracks.length > 1 ? plainRichText(localizedUnit(work.tracks[state.track]).title || '') : '';
    var thumb = unit.image && unit.image !== work.image ? unit.image : (work.thumb || work.image || '');
    return '<div class="tt-mini' + (state.playing ? ' is-playing' : '') + '" role="region" aria-label="' + esc(labels.nowPlaying) + '">' +
      '<button type="button" class="tt-mini-main" data-works-action="mini-deck"><img src="' + esc(thumb) + '" alt="" decoding="async">' +
        '<span class="tt-mini-text"><span class="tt-mini-title">' + esc(track || title) + '</span><span class="tt-mini-artist">' + esc(plainRichText(unit.artist || work.artist || '')) + '</span></span></button>' +
      '<button type="button" class="tt-mini-play' + (state.playing ? ' is-playing' : '') + '" data-works-action="toggle" aria-label="' + esc((state.playing ? labels.pause : labels.play) + ': ' + (track || title)) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span></button>' +
    '</div>';
  }
  var miniFrame = 0;
  function syncMini() {
    miniFrame = 0;
    var host = root && root.querySelector('.tt-mini-host');
    if (!host) return;
    var deck = root.querySelector('.tt-crate-deck'), box = root.getBoundingClientRect();
    var inWorks = box.top < window.innerHeight * 0.6 && box.bottom > window.innerHeight * 0.4;
    var deckAway = !!deck && deck.getBoundingClientRect().bottom < 0;
    host.classList.toggle('is-on', !!host.firstChild && state.tab === 'songs' && inWorks && deckAway);
  }
  function updateMini() {
    var host = root && root.querySelector('.tt-mini-host');
    if (host) host.innerHTML = miniHtml();
    syncMini();
  }
  (function watchMini() {
    var page = document.getElementById('content');
    var queue = function () { if (!miniFrame) miniFrame = requestAnimationFrame(syncMini); };
    if (page) page.addEventListener('scroll', queue, { passive: true }); else return setTimeout(watchMini, 500);
    window.addEventListener('resize', queue);
  })();

  // tablets and up: the rack grid with album shelves
  function rackListHtml(list) {
    var labels = L(), blocks = [];
    // list is newest first with each album's tracks together (entriesFor): runs of singles and album blocks, in order
    list.forEach(function (entry) {
      var last = blocks[blocks.length - 1];
      var kind = entry.track == null ? 'singles' : 'album:' + entry.index;
      if (!last || last.kind !== kind) { last = { kind: kind, index: entry.index, entries: [] }; blocks.push(last); }
      last.entries.push(entry);
    });
    if (isPhone()) return sleeveListHtml(blocks);
    var order = 0;
    var row = function (entries) {
      return '<ul class="tt-shelf-row' + (isPhone() ? ' tt-m-carousel' : '') + '">' + entries.map(function (entry) { return rackItemHtml(entry, order++); }).join('') + '</ul>';
    };
    var count = function (n) { return n + (pageLangKey() === 'en' ? ' ' : '') + esc(labels.songs); };
    var html = blocks.map(function (block) {
          if (block.kind === 'singles') return '<div class="tt-shelf-block">' + row(block.entries) + '</div>';
          var work = works[block.index], unit = localizedUnit(work);
          var name = plainRichText(String(unit.title || work.title || '').replace(/\s*\[ALBUM\]\s*$/i, ''));
          var artist = plainRichText(unit.artist || work.artist || '');
          var total = (work.tracks || []).length, shown = block.entries.length;
          return '<div class="tt-shelf-block tt-shelf-album" aria-label="' + esc(name) + '">' +
            '<div class="tt-shelf-plate' + (state.current === block.index ? ' is-current' : '') + '" data-works-book="' + block.index + '">' +
              '<button type="button" class="tt-shelf-plate-cover" data-works-action="pick" data-index="' + block.index + '" tabindex="-1" aria-label="' + esc(name + ' — ' + labels.albumPick) + '"><img src="' + esc(work.thumb || work.image || '') + '" alt="" loading="lazy" decoding="async"></button>' +
              '<span class="tt-shelf-plate-text"><span class="tt-shelf-plate-name">' + esc(name) + '</span><span class="tt-shelf-plate-artist">' + esc(artist) + '</span></span>' +
              '<span class="tt-shelf-plate-count">' + (shown !== total ? shown + ' / ' : '') + count(total) + '</span>' +
            '</div>' + row(block.entries) + '</div>';
    }).join('');
    return '<div class="tt-rack-grid tt-rack-shelves">' + html + '</div>';
  }

  function render(before) {
    if (!root) root = ensureRoot();
    if (!root) return;
    var list = visibleWorks();
    // a re-render (a language switch, a pick) keeps the rack and the open popup where the visitor left them
    var kept = ['.tt-rack-grid', '.tt-shelf-modal-panel'].map(function (sel) { var el = root.querySelector(sel); return el && [sel, el.scrollTop, el.scrollLeft]; }).filter(Boolean);
    var body = state.tab === 'mix' ? mixHtml('mixWorks', ownPostItems().concat(etcPostItems()), true, Object.keys(POST_ROLES))
      : state.tab === 'arr' ? mixHtml('bgmWorks')
      : tabHeadHtml('productionWorks') + '<div class="tt-crate-stage">' +
          '<div class="tt-crate-deck">' + deckHtml() + '</div>' +
          '<div class="tt-crate-rack">' + filtersHtml() + rackListHtml(list) + '</div>' +
        '</div>';
    root.innerHTML = '<div class="tt-shelf tt-crate is-tab-' + state.tab + (state.settled ? ' is-settled' : '') + (state.engaged ? ' is-engaged' : '') + '">' + headHtml() + tabsHtml() +
      body + clientsHtml() + '<div class="tt-mini-host">' + miniHtml() + '</div>' +
      (state.modal >= 0 ? modalHtml(state.modal) : '') + '</div>';
    mounted = true;
    if (!state.settled) setTimeout(function () { state.settled = true; var shelf = root && root.querySelector('.tt-shelf'); if (shelf) shelf.classList.add('is-settled'); }, 1400);
    bindLazyCovers();
    watchDeck();
    sizeRack();
    kept.forEach(function (k) { var el = root.querySelector(k[0]); if (el) { el.scrollTop = k[1]; el.scrollLeft = k[2]; } });
    handOffRackScroll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeRack);
    if (before) shuffleFrom(before);
    playPending();
    window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }

  // The rack is as tall as the turntable column with Early Spring on it (turntable, its details and the
  // track buttons), so the rack and the deck end on the same line whatever is playing
  var RACK_REFERENCE = 'early-spring';
  function sizeRack() {
    var deckHost = root && root.querySelector('.tt-crate-deck');
    var rack = root && root.querySelector('.tt-crate-rack');
    var grid = rack && rack.querySelector('.tt-rack-grid');
    if (!deckHost || !grid) return;
    if (window.innerWidth <= 860) { grid.style.maxHeight = ''; return; } // stacked: the screen sets it (CSS)
    var ref = works.findIndex(function (work) { return work.slug === RACK_REFERENCE; });
    if (ref < 0) ref = state.current;
    var keep = { current: state.current, track: state.track, language: state.language };
    state.current = ref;
    state.track = titleTrackIndex(works[ref]);
    state.language = defaultLanguage(works[ref], state.track);
    var probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:' + deckHost.clientWidth + 'px;visibility:hidden;pointer-events:none';
    probe.innerHTML = deckHtml();
    state.current = keep.current; state.track = keep.track; state.language = keep.language;
    deckHost.appendChild(probe);
    var height = probe.offsetHeight;
    probe.remove();
    var offset = grid.getBoundingClientRect().top - rack.getBoundingClientRect().top;
    grid.style.maxHeight = Math.max(240, Math.round(height - offset)) + 'px';
  }

  // At either end of the rack the wheel moves the page on, even within one continuous gesture
  // (browsers keep a gesture latched to the inner scroller, which would hold the page in place)
  function handOffRackScroll() {
    var grid = root && root.querySelector('.tt-rack-grid');
    var page = document.getElementById('content');
    if (!grid || !page || grid.__ttHandOff) return;
    grid.__ttHandOff = true;
    grid.addEventListener('wheel', function (event) {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      var atTop = grid.scrollTop <= 0, atEnd = grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 1;
      if ((event.deltaY > 0 && atEnd) || (event.deltaY < 0 && atTop)) {
        event.preventDefault();
        page.scrollBy({ top: event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY, behavior: 'instant' });
      }
    }, { passive: false });
  }

  var deckObserver = null;
  function watchDeck() {
    var deck = root && root.querySelector('.tt-crate-deck');
    if (!deck || !('IntersectionObserver' in window)) return;
    if (deckObserver) deckObserver.disconnect();
    deckObserver = new IntersectionObserver(function (entries) {
      var shelf = root && root.querySelector('.tt-shelf');
      if (shelf) shelf.classList.toggle('is-deck-away', !entries[0].isIntersecting);
    }, { root: document.getElementById('content'), threshold: 0.15 });
    deckObserver.observe(deck);
  }

  function pick(index, track) {
    if (track != null && !isNaN(track)) {
      if (index === state.current && track === state.track) { if (state.playing) pauseAll(); else { if (!audio || !audio.getAttribute('src')) loadCurrent(false); resume(); } return; }
      var album = works[index]; if (!album) return;
      state.current = index; state.track = track;
      state.language = defaultLanguage(album, track);
      refreshPlaying(true);
      loadCurrent(false); resume();
      return;
    }
    if (index === state.current) { if (state.playing) pauseAll(); else { if (!audio || !audio.getAttribute('src')) loadCurrent(false); resume(); } return; }
    var work = works[index]; if (!work) return;
    state.current = index;
    state.track = titleTrackIndex(work);
    state.language = defaultLanguage(work, state.track);
    refreshPlaying(true);
    if (hasAudio(work)) { loadCurrent(false); resume(); }
  }

  var coverObserver = null;
  function bindLazyCovers() {
    var pending = root ? root.querySelectorAll('img[data-src]') : [];
    if (!pending.length) return;
    if (!('IntersectionObserver' in window)) { pending.forEach(loadCover); return; }
    if (coverObserver) coverObserver.disconnect();
    coverObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { loadCover(entry.target); coverObserver.unobserve(entry.target); } });
      // on phones the year shelves stack in the page (each one a sideways row), so covers wait for the screen
    }, { root: isPhone() ? null : root.querySelector('.tt-rack-grid'), rootMargin: '160px 160px' });
    pending.forEach(function (img) { coverObserver.observe(img); });
  }
  function loadCover(img) {
    if (!img.dataset.src) return;
    // the rack's own observer already decided this cover is needed; do not let native lazy loading defer it again
    img.loading = 'eager';
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }

  // ---- the popup: opened and closed in place, the shelf behind it is not rebuilt ----
  function openModal(index, trigger) {
    if (!root || !works[index]) return;
    closeModal(false);
    state.modal = index;
    if (trigger && window.TALETONE_SITE_UX) window.TALETONE_SITE_UX.rememberDialogTrigger(trigger);
    var shelf = root.querySelector('.tt-shelf');
    var holder = document.createElement('div'); holder.innerHTML = modalHtml(index);
    shelf.appendChild(holder.firstChild);
    window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }
  function closeModal(notify) {
    var modal = root && root.querySelector('.tt-shelf-modal');
    state.modal = -1;
    if (!modal) return;
    modal.remove();
    if (notify !== false) window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }

  // ---- playback: one audio element for a record; its language versions play together (below) ----
  // Volume is linear amplitude, so 50% is exactly -6.02 dB. It runs through a Web Audio gain node where
  // possible, because iOS Safari ignores audio.volume; elsewhere audio.volume is the fallback.
  var gainCtx = null, gainNode = null, trackNode = null, elementRouted = false;
  // the scene reads how loud the song is right now, so the deep sea can light up with it
  var analyser = null, levelBuf = null;
  window.TALETONE_AUDIO_PLAYING = function () { return !!state.playing; };
  window.TALETONE_AUDIO_LEVEL = function () {
    if (!analyser || !state.playing || state.volume < 0.02) return 0;
    analyser.getFloatTimeDomainData(levelBuf);
    var sum = 0;
    for (var i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
    // RMS after the volume knob, divided back out: the light follows the music, not the volume setting
    var rms = Math.sqrt(sum / levelBuf.length) / state.volume;
    return Math.min(1, Math.pow(rms / 0.32, 1.3));
  };
  // Every record plays at the same loudness: scripts/measure-loudness.mjs measures each file (BS.1770 integrated,
  // target -14 LUFS) and writes the gain it needs into the works data (`loudness.files[path].gain`, dB). The file
  // is left as it is; the gain is applied here, before the volume.
  var loudness = {}, elementGain = 1;
  function loudnessGain(path) {
    var entry = path && loudness[path];
    return entry && isFinite(entry.gain) ? Math.pow(10, entry.gain / 20) : 1;
  }
  function volumeText(v) {
    return Math.round(v * 100) + '% (' + (v > 0 ? (20 * Math.log10(v)).toFixed(1) + ' dB' : '-∞ dB') + ')';
  }
  function applyVolume() {
    if (gainNode) gainNode.gain.value = state.volume;
    if (trackNode) trackNode.gain.value = elementGain;
    // without Web Audio the element's own volume carries both (it cannot go above 1)
    if (audio && !elementRouted) audio.volume = Math.min(1, state.volume * elementGain);
  }
  // the audio clock and the master volume every source plays through
  function ensureCtx() {
    if (gainCtx) return gainCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      gainCtx = new AC();
      gainNode = gainCtx.createGain();
      gainNode.connect(gainCtx.destination);
      trackNode = gainCtx.createGain();
      trackNode.connect(gainNode);
      if (gainCtx.createAnalyser) {
        analyser = gainCtx.createAnalyser();
        analyser.fftSize = 1024;
        levelBuf = new Float32Array(analyser.fftSize);
        gainNode.connect(analyser);
      }
    } catch (_e) { gainCtx = null; gainNode = null; trackNode = null; analyser = null; }
    applyVolume();
    return gainCtx;
  }
  function ensureGain() {
    if (elementRouted || !audio || !ensureCtx()) return;
    try {
      gainCtx.createMediaElementSource(audio).connect(trackNode);
      audio.volume = 1;
      elementRouted = true;
    } catch (_e) {}
    applyVolume();
  }

  // ---- language versions: all of them play at once, in step; a switch moves only their volumes ----
  // The KR and JP versions of a single share one arrangement, so both are decoded and started on the same
  // instant of the audio clock: the chosen language is heard, the other runs silent, and switching is a
  // 15 ms crossfade with no reload and no gap. If they cannot be decoded, the element plays one version at
  // a time instead (a switch then reloads at the same position).
  var layerBuffers = {};                     // url -> Promise<AudioBuffer>
  var layer = null;                          // { key, sources: { LANG: { source, gain } }, startedAt, offset, duration }
  var layerPaused = { key: '', offset: 0 };  // where a paused record resumes
  var layerToken = 0, layerLoading = false, layerFailed = {};
  function layeredEntries() {
    var work = works[state.current]; if (!work) return [];
    var list = variantsFor(work, state.track).map(function (version, i) { return { language: languageLabel(version, i), url: audioUrl(version.audio), level: loudnessGain(version.audio) }; })
      .filter(function (entry) { return entry.url; });
    return list.length > 1 ? list : [];
  }
  function layerKey(entries) { return state.current + '|' + state.track + '|' + entries.map(function (e) { return e.url; }).join('|'); }
  function layerBuffer(url) {
    if (!layerBuffers[url]) {
      layerBuffers[url] = fetch(url).then(function (response) { if (!response.ok) throw new Error('audio ' + response.status); return response.arrayBuffer(); })
        .then(function (data) { return new Promise(function (ok, fail) { var p = gainCtx.decodeAudioData(data, ok, fail); if (p && p.then) p.then(ok, fail); }); })
        .catch(function (error) { delete layerBuffers[url]; throw error; });
    }
    return layerBuffers[url];
  }
  function layerPosition() { return layer ? Math.min(layer.duration, layer.offset + Math.max(0, gainCtx.currentTime - layer.startedAt)) : 0; }
  function stopLayer(keepPosition) {
    layerToken++;
    layerLoading = false;
    if (!layer) return;
    if (keepPosition) layerPaused = { key: layer.key, offset: layerPosition() };
    var old = layer; layer = null;
    Object.keys(old.sources).forEach(function (lang) {
      var node = old.sources[lang];
      node.source.onended = null;
      try { node.source.stop(); } catch (_e) {}
      try { node.gain.disconnect(); } catch (_e2) {}
    });
  }
  function setLayerLanguage() {
    if (!layer) return;
    var now = gainCtx.currentTime;
    Object.keys(layer.sources).forEach(function (lang) {
      var g = layer.sources[lang].gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(lang === state.language ? layer.sources[lang].level : 0, now + 0.015);
    });
  }
  // Plays the current record's language versions together. Returns false when it has none to layer (or
  // they failed to decode), and the element plays it instead.
  function playLayered() {
    var entries = layeredEntries(), key = entries.length ? layerKey(entries) : '';
    if (!entries.length || layerFailed[key] || !ensureCtx() || !window.fetch) { stopLayer(false); return false; }
    if (layer && layer.key === key) return true;
    stopLayer(false);
    var token = ++layerToken;
    layerLoading = true;
    if (audio && !audio.paused) audio.pause();
    Promise.all(entries.map(function (entry) { return layerBuffer(entry.url); })).then(function (buffers) {
      if (token !== layerToken || !state.playing) return;
      layerLoading = false;
      var durations = buffers.map(function (b) { return b.duration; });
      var duration = Math.min.apply(Math, durations), shortest = durations.indexOf(duration);
      var offset = layerPaused.key === key && layerPaused.offset < duration - 0.05 ? layerPaused.offset : 0;
      var when = gainCtx.currentTime + 0.03, sources = {};
      entries.forEach(function (entry, i) {
        var source = gainCtx.createBufferSource(), gain = gainCtx.createGain();
        source.buffer = buffers[i];
        gain.gain.value = entry.language === state.language ? entry.level : 0;
        source.connect(gain);
        gain.connect(gainNode);
        source.start(when, offset);
        sources[entry.language] = { source: source, gain: gain, level: entry.level };
      });
      layer = { key: key, sources: sources, startedAt: when, offset: offset, duration: duration };
      // the end of the shortest version ends the record
      sources[entries[shortest].language].source.onended = function () {
        stopLayer(false);
        layerPaused = { key: '', offset: 0 };
        state.playing = false; setMediaStatus('playback', 'ended'); refreshPlaying();
      };
      setMediaStatus('audio-engine', 'layered');
    }).catch(function () {
      if (token !== layerToken) return;
      layerLoading = false;
      layerFailed[key] = true;
      if (!state.playing) return;
      loadCurrent(false);
      playElement();
    });
    return true;
  }
  function onVolumeInput(event) {
    var input = event.target;
    if (!input || !input.matches || !input.matches('[data-works-volume]')) return;
    state.volume = Math.max(0, Math.min(1, Number(input.value) / 100));
    input.style.setProperty('--v', state.volume);
    input.setAttribute('aria-valuetext', volumeText(state.volume));
    applyVolume();
  }
  function ensureAudioEl() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.volume = state.volume;
    audio.addEventListener('ended', function () { state.playing = false; setMediaStatus('playback', 'ended'); refreshPlaying(); });
    // (not when it was paused to hand the record over to its layered language versions)
    audio.addEventListener('pause', function () { if (state.playing && audio.paused && !layer && !layerLoading) { state.playing = false; refreshPlaying(); } });
    // the element is the truth: if it plays, the deck shows it playing
    audio.addEventListener('playing', function () { if (!priming && !state.playing) { state.playing = true; setMediaStatus('playback', 'playing'); refreshPlaying(); } });
    return audio;
  }
  function loadCurrent(keepTime) {
    var work = works[state.current]; if (!work) return;
    var unit = playableUnit(work, state.track, state.language);
    var src = audioUrl(unit.audio);
    var el = ensureAudioEl();
    elementGain = loudnessGain(unit.audio);
    applyVolume();
    var time = keepTime ? el.currentTime : 0;
    if (src && el.getAttribute('src') !== src) {
      el.setAttribute('src', src);
      if (time) el.addEventListener('loadedmetadata', function () { try { el.currentTime = Math.min(time, (el.duration || time) - 0.2); } catch (_e) {} }, { once: true });
    }
  }
  function playIndex(index, track) {
    var work = works[index]; if (!work) return;
    if (state.current !== index || track != null) {
      state.current = index;
      state.track = track != null ? track : titleTrackIndex(work);
      state.language = defaultLanguage(work, state.track);
    }
    loadCurrent(false);
    resume();
  }
  var playAttempt = 0;
  // A "listen in Works" link (/works/?work=<slug>) asks for a record before Works is on screen. Browsers
  // only allow sound that starts from a click, so the click starts the audio element silently and stops it;
  // the real play() follows once the Works chapter is reached.
  var pendingSlug = '', priming = false;
  function indexOfSlug(slug) {
    for (var i = 0; i < works.length; i++) if (works[i].slug === slug) return i;
    return -1;
  }
  function primeAudio() {
    var el = ensureAudioEl();
    ensureGain();
    if (gainCtx && gainCtx.state === 'suspended') gainCtx.resume();
    if (!el.paused) return;
    priming = true;
    el.muted = true;
    var finish = function () { if (!priming) return; priming = false; el.pause(); el.muted = false; };
    var attempt = el.play();
    if (attempt && attempt.then) attempt.then(finish, finish); else finish();
  }
  function queueWork(slug) {
    pendingSlug = String(slug || '');
    var index = indexOfSlug(pendingSlug);
    if (index >= 0) {
      state.current = index;
      state.track = titleTrackIndex(works[index]);
      state.language = defaultLanguage(works[index], state.track);
      loadCurrent(false);
    }
    primeAudio();
    if (!mounted) init();
  }
  function playPending(force) {
    if (!pendingSlug || !works.length || !root || !mounted || !(force || isWorksChapterActive())) return;
    var index = indexOfSlug(pendingSlug);
    pendingSlug = '';
    if (index < 0) return;
    if (!visibleWorks().some(function (entry) { return entry.index === index; })) {
      state.filter = 'all';
      PRE_ROLES.forEach(function (role) { state.roles[role] = true; });
      render();
    }
    closeModal(false);
    state.current = index;
    state.track = titleTrackIndex(works[index]);
    state.language = defaultLanguage(works[index], state.track);
    if (isPhone() && isAlbum(works[index]) && !state.openAlbums[index]) { state.openAlbums[index] = true; render(); }
    refreshPlaying(true);
    revealInRack(index);
    if (hasAudio(works[index])) { loadCurrent(false); resume(); }
  }
  // scroll only the rack (not the page) so the chosen sleeve is in view
  function revealInRack(index) {
    var grid = root && root.querySelector('.tt-rack-grid');
    var book = root && root.querySelector('[data-works-book="' + index + '"]');
    if (!grid || !book) return;
    var g = grid.getBoundingClientRect(), b = book.getBoundingClientRect();
    grid.scrollTop += (b.top - g.top) - (grid.clientHeight - b.height) / 2;
    grid.scrollLeft += (b.left - g.left) - (grid.clientWidth - b.width) / 2;
  }
  function resume() {
    state.engaged = true;
    priming = false;
    var engagedShelf = root && root.querySelector('.tt-shelf'); if (engagedShelf) engagedShelf.classList.add('is-engaged');
    var video = root && root.querySelector('.tt-shelf-yt.is-playing');
    if (video) { video.closest('.tt-shelf-modal-stage') && closeVideo(video); }
    if (ensureCtx() && gainCtx.state === 'suspended') gainCtx.resume();
    state.playing = true;
    setMediaStatus('playback', 'playing');
    if (!playLayered()) playElement();
    refreshPlaying(true);
    announce(L().nowPlaying + ': ' + currentTitle());
  }
  function playElement() {
    var el = ensureAudioEl();
    el.muted = false;
    ensureGain();
    var attempt = el.play();
    var token = ++playAttempt;
    // Switching records quickly aborts the previous play() (AbortError) after the new one has started;
    // only a refusal of the latest attempt means playback really was blocked.
    if (attempt && attempt.catch) attempt.catch(function (error) {
      if (token !== playAttempt || (error && error.name === 'AbortError') || !el.paused) return;
      state.playing = false; setMediaStatus('playback', 'blocked'); refreshPlaying();
    });
  }
  function closeVideo(wrap) {
    var id = wrap.getAttribute('data-yt');
    var title = (wrap.querySelector('iframe') || {}).title || '';
    wrap.classList.remove('is-playing');
    wrap.innerHTML = '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt=""><button type="button" class="tt-shelf-yt-play" data-works-action="video" aria-label="' + esc(title) + '"><span aria-hidden="true"></span></button>';
  }
  function pauseAll() {
    stopLayer(true);
    if (audio && !audio.paused) audio.pause();
    if (state.playing) { state.playing = false; setMediaStatus('playback', 'paused'); refreshPlaying(); announce(L().pause); }
  }
  // one short line for screen readers (the rack itself is not a live region)
  function announce(text) {
    var section = document.getElementById('c-works');
    if (!section) return;
    var status = document.getElementById('tt-works-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'tt-works-status';
      status.className = 'tt-sr-only';
      status.setAttribute('role', 'status');
      section.appendChild(status);
    }
    status.textContent = '';
    setTimeout(function () { status.textContent = text; }, 60);
  }
  function currentTitle() {
    var work = works[state.current];
    return work ? plainRichText(localizedUnit(work).title || work.title || '') : '';
  }
  function stopAll() {
    pauseAll();
    layerPaused = { key: '', offset: 0 };
    if (audio) { audio.removeAttribute('src'); audio.load(); }
    state.engaged = false;
    var stoppedShelf = root && root.querySelector('.tt-shelf'); if (stoppedShelf) stoppedShelf.classList.remove('is-engaged');
    refreshPlaying(true);
  }
  // Light update: play states, the record sleeves and the player, without rebuilding the shelf
  function refreshPlaying(rebuild) {
    if (!root) return;
    var labels = L();
    root.querySelectorAll('[data-works-book]').forEach(function (item) {
      var key = item.getAttribute('data-works-book');
      var on = key === String(state.current) || key === state.current + '-' + state.track;
      item.classList.toggle('is-current', on);
      item.classList.toggle('is-playing', on && state.playing);
    });
    var deckHost = root.querySelector('.tt-crate-deck');
    if (deckHost && rebuild) deckHost.innerHTML = deckHtml();
    updateMini();
    var deck = root.querySelector('.tt-deck');
    if (deck) {
      deck.classList.toggle('is-playing', state.playing);
      var toggle = deck.querySelector('.tt-deck-toggle');
      if (toggle) { toggle.classList.toggle('is-playing', state.playing); toggle.setAttribute('aria-label', (state.playing ? labels.pause : labels.play) + ': ' + ((deck.querySelector('.tt-deck-title') || {}).textContent || '')); }
    }
    root.querySelectorAll('.tt-shelf-listen').forEach(function (button) {
      var on = Number(button.getAttribute('data-index')) === state.current && state.playing;
      button.classList.toggle('is-playing', on);
      var text = button.querySelector('.tt-shelf-listen-label'); if (text) text.textContent = on ? labels.pause : labels.listen;
    });
    root.querySelectorAll('[data-works-action="modal-track"]').forEach(function (button) {
      button.classList.toggle('is-on', Number(button.getAttribute('data-index')) === state.current && Number(button.getAttribute('data-track')) === state.track);
    });
    // an open album popup follows the chosen track with its credits
    var info = root.querySelector('.tt-shelf-modal-info'), shown = works[state.modal];
    if (info && shown && shown.tracks && shown.tracks.length > 1) {
      var credit = creditsFor(shown, state.modal), old = info.querySelector('.tt-shelf-modal-credits');
      if (!old || old.getAttribute('aria-label') !== credit.label) {
        var holder = document.createElement('div'); holder.innerHTML = credit.text ? creditsHtml(credit.text, credit.label) : '';
        if (old && holder.firstChild) old.replaceWith(holder.firstChild); else if (old) old.remove(); else if (holder.firstChild) info.appendChild(holder.firstChild);
      }
      var stage = root.querySelector('.tt-shelf-modal-stage'), yt = stage && stage.querySelector('[data-yt]'), want = videoFor(shown, state.modal);
      if (yt && want && yt.getAttribute('data-yt') !== want) {
        var fresh = document.createElement('div'); fresh.innerHTML = modalHtml(state.modal);
        var next = fresh.querySelector('.tt-shelf-modal-stage'); if (next) stage.replaceWith(next);
      }
    }
  }

  function isWorksChapterActive() {
    var activeChapter = (document.body && document.body.getAttribute('data-active-chapter')) || '';
    if (activeChapter) return activeChapter === 'works';
    return /^(?:\/(?:en|ja))?\/works(?:\/index\.html)?\/?$/i.test(location.pathname) || location.hash === '#c-works';
  }

  function onClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-works-action]') : null;
    var section = document.getElementById('c-works');
    if (!button || !section || !section.contains(button)) return;
    var action = button.getAttribute('data-works-action');
    // the full career history lives in the profile sheet the app renders
    if (action === 'history') { window.dispatchEvent(new CustomEvent('TALETONE_OPEN_HISTORY')); return; }
    if (action === 'tab') {
      state.tab = button.getAttribute('data-tab') || 'songs';
      render();
      var tabEl = root && root.querySelector('[data-works-action="tab"][data-tab="' + state.tab + '"]'); if (tabEl) tabEl.focus({ preventScroll: true });
    } else if (action === 'more') {
      state.mixShown += 12;
      render();
    } else if (action === 'mini-deck') {
      var deckEl = root && root.querySelector('.tt-crate-deck'), pageEl = document.getElementById('content');
      if (deckEl && pageEl) pageEl.scrollTo({ top: pageEl.scrollTop + deckEl.getBoundingClientRect().top - 90, behavior: 'smooth' });
    } else if (action === 'album') {
      var albumIndex = Number(button.getAttribute('data-index'));
      state.openAlbums[albumIndex] = !state.openAlbums[albumIndex];
      render();
      var head = root && root.querySelector('[data-works-action="album"][data-index="' + albumIndex + '"]'); if (head) head.focus({ preventScroll: true });
    } else if (action === 'role') {
      var role = button.getAttribute('data-role');
      var group = button.getAttribute('data-group') === PRE_ROLES[0] ? PRE_ROLES : Object.keys(POST_ROLES);
      var rects = state.tab === 'songs' ? bookRects() : null;
      var setAll = function (on) { group.forEach(function (r) { state.roles[r] = on; }); };
      if (role === 'all') setAll(true);
      else if (rolesAllOn(group)) { setAll(false); state.roles[role] = true; } // from 전체, keep only the picked role
      else {
        state.roles[role] = !state.roles[role];
        if (!group.some(function (r) { return state.roles[r]; })) setAll(true); // nothing left: back to 전체
      }
      render(rects);
      announce(L()[role] + ' · ' + (role === 'all' || state.roles[role] ? 'on' : 'off'));
      var roleChip = root && root.querySelector('[data-works-action="role"][data-group="' + group[0] + '"][data-role="' + role + '"]'); if (roleChip) roleChip.focus({ preventScroll: true });
    } else if (action === 'filter') {
      var before = bookRects();
      state.filter = button.getAttribute('data-filter') || 'all';
      render(before);
      announce((L()[state.filter] || state.filter) + ' · ' + visibleWorks().length);
      var chip = root && root.querySelector('[data-filter="' + state.filter + '"]'); if (chip) chip.focus({ preventScroll: true });
    } else if (action === 'pick') {
      pick(Number(button.getAttribute('data-index')), button.hasAttribute('data-track') ? Number(button.getAttribute('data-track')) : null);

    } else if (action === 'open') {
      event.preventDefault();
      openModal(Number(button.getAttribute('data-index')), button);
    } else if (action === 'close') {
      closeModal();
    } else if (action === 'video') {
      var wrap = button.closest('.tt-shelf-yt');
      if (wrap) {
        pauseAll();
        var frame = document.createElement('iframe');
        frame.src = 'https://www.youtube-nocookie.com/embed/' + wrap.getAttribute('data-yt') + '?autoplay=1&rel=0&playsinline=1';
        frame.title = button.getAttribute('aria-label') || 'YouTube';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        frame.allowFullscreen = true;
        wrap.replaceChildren(frame);
        wrap.classList.add('is-playing');
      }
    } else if (action === 'close-backdrop') {
      if (event.target === button) closeModal();
    } else if (action === 'play') {
      event.preventDefault();
      var index = Number(button.getAttribute('data-index'));
      if (index === state.current && state.playing) pauseAll(); else if (index === state.current) resume(); else { playIndex(index); refreshPlaying(true); }
    } else if (action === 'modal-track') {
      playIndex(Number(button.getAttribute('data-index')), Number(button.getAttribute('data-track')) || 0);
    } else if (action === 'toggle') {
      if (state.playing) pauseAll(); else { if (!audio || !audio.getAttribute('src')) loadCurrent(false); resume(); }
    } else if (action === 'track') {
      state.track = Number(button.getAttribute('data-track')) || 0;
      state.language = defaultLanguage(works[state.current], state.track);
      loadCurrent(false); resume(); refreshPlaying(true);
    } else if (action === 'language') {
      state.language = button.getAttribute('data-language') || state.language;
      var entries = layeredEntries();
      if (entries.length && !layerFailed[layerKey(entries)]) {
        // layered: playing moves the volumes; loading or paused, the next start uses the new language
        setLayerLanguage();
        refreshPlaying(true);
      } else {
        var wasPlaying = state.playing;
        loadCurrent(true);
        if (wasPlaying) resume(); else refreshPlaying(true);
      }
    }
  }
  // stop the music once the reader leaves the Works chapter
  function bindVisibilityPause() {
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseAll(); });
  }

  function ensureRoot() {
    var section = document.getElementById('c-works');
    if (!section) return null;
    section.classList.add('tt-gh-works');
    var app = document.getElementById('tt-gh-works-app');
    if (!app || !section.contains(app)) {
      section.innerHTML = '<div id="tt-gh-works-app"></div>';
      app = document.getElementById('tt-gh-works-app');
    }
    return app;
  }
  function scrollToWorksFromHash() {
    if (location.hash !== '#c-works') return;
    var content = document.getElementById('content');
    var section = document.getElementById('c-works');
    if (content && section) content.scrollTo({ top: section.offsetTop - 2, behavior: 'auto' });
  }
  function waitForHost(attempt) {
    var app = ensureRoot();
    if (app) { root = app; render(); setTimeout(scrollToWorksFromHash, 100); return; }
    if ((attempt || 0) < 80) setTimeout(function () { waitForHost((attempt || 0) + 1); }, 150);
  }
  function boot(json) {
    bindWorksInteractions();
    works = json.works || [];
    logos = json.clientLogos || [];
    loudness = (json.loudness && json.loudness.files) || {};
    if (works.length) { // the turntable starts on the rack's first record (a featured one when any is pinned)
      var lead = entriesFor('all')[0] || { index: 0 };
      state.current = lead.index; state.track = titleTrackIndex(works[lead.index]); state.language = defaultLanguage(works[lead.index], state.track);
    }
    // a link opened in a new tab (/works/?work=<slug>) selects that record; it plays if the browser allows
    var asked = pendingSlug || new URLSearchParams(location.search).get('work') || '';
    if (asked) queueWork(asked);
    setTimeout(function () { waitForHost(0); }, 120);
  }
  function setEditorData(json) {
    if (!json || !json.works) return;
    bindWorksInteractions();
    stopAll();
    works = json.works || [];
    logos = json.clientLogos || [];
    loudness = (json.loudness && json.loudness.files) || {};
    state.modal = -1;
    render();
  }
  function selectEditorWork(payload) {
    // (the editor scrolls the rack to the chosen record)
    var index = payload && typeof payload === 'object' ? payload.index : payload;
    var book = root && root.querySelector('[data-works-book="' + Number(index) + '"]');
    if (book) book.scrollIntoView({ block: 'center' });
  }

  var lastWidthStep = 0;
  function onResize() {
    sizeRack();
    var step = shelfStep() + (isPhone() ? 100 : 0);
    if (mounted && step !== lastWidthStep) { lastWidthStep = step; render(); }
  }

  window.TALETONE_WORKS_API = {
    setData: setEditorData,
    setMeta: setMeta,
    select: selectEditorWork,
    pauseAll: function () { pauseAll(); },
    queue: queueWork
  };

  window.addEventListener('TALETONE_CHAPTER_CHANGE', function (event) {
    var chapter = event && event.detail ? event.detail.chapter : '';
    if (!chapter) return;
    if (chapter !== 'works') { pauseAll(); return; }
    if (!mounted) init();
    else playPending(true);
  });

  window.addEventListener('TALETONE_CHAPTER_PRELOAD', function (event) {
    if (!event.detail || event.detail.chapter !== 'works') return;
    var section = document.getElementById('c-works');
    if (section) section.setAttribute('data-chapter-preloaded', '');
    if (!mounted) init();
  });

  // only this site's own origin may push data or language into the Works module (see component.js)
  window.addEventListener('message', function (event) {
    if (!event || event.origin !== window.location.origin) return;
    var message = event.data || {};
    if (message.type === 'TALETONE_WORKS_SET_DATA') setEditorData(message.data);
    if (message.type === 'TALETONE_SITE_SET_DATA' && message.data) {
      liveSiteContent = message.data;
      setMeta(message.data.worksMeta || {});
    }
    if (message.type === 'TALETONE_SET_LANG' && mounted) render();
    if (message.type === 'TALETONE_WORKS_SELECT') selectEditorWork(message);
  });

  function init() {
    if (worksDataPromise) return worksDataPromise;
    worksDataPromise = fetch(new URL('data/works-data.json', assetBase).href)
      .then(function (response) {
        if (!response.ok) throw new Error('WORKS data request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) { boot(data); return data; })
      .catch(function (error) {
        worksDataPromise = null;
        console.error('[works]', error);
        return null;
      });
    return worksDataPromise;
  }

  function bindWorksInteractions() {
    if (worksInteractionsBound) return;
    worksInteractionsBound = true;
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onRackKey);
    document.addEventListener('input', onVolumeInput);
    window.addEventListener('hashchange', scrollToWorksFromHash);
    window.addEventListener('resize', onResize, { passive: true });
    bindVisibilityPause();
  }
  // Works is built when its chapter comes near; a keyboard user's first key press or focus builds it too,
  // so Tab can reach the rack instead of skipping a chapter that is not there yet
  function initForKeyboard() {
    document.removeEventListener('keydown', initForKeyboard, true);
    document.removeEventListener('focusin', initForKeyboard, true);
    if (!mounted) init();
  }
  function start() {
    if (isWorksChapterActive() || window.parent !== window) init();
    document.addEventListener('keydown', initForKeyboard, true);
    document.addEventListener('focusin', initForKeyboard, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
