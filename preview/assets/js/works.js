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
  function plainNewsPreviewText(value) {
    var source = String(value == null ? '' : value);
    if (!source) return '';
    var template = document.createElement('template');
    template.innerHTML = source;
    return String(template.content.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function localizedNewsItem(item) {
    var result = Object.assign({}, item || {});
    var translated = item && item.translations && item.translations[pageLangKey()];
    if (translated && typeof translated === 'object') Object.assign(result, translated);
    return result;
  }
  function patchNewsPreviews() {
    var content = liveSiteContent || window.TALETONE_CONTENT;
    if (!content || !Array.isArray(content.news)) return;
    document.querySelectorAll('#c-news .lift').forEach(function (card, index) {
      var item = localizedNewsItem(content.news[index]);
      var preview = card.querySelector('p');
      if (!preview) return;
      var text = plainNewsPreviewText(item.summary || item.body || '');
      preview.classList.add('tt-news-card-preview');
      if (text && preview.textContent !== text) preview.textContent = text;
    });
  }
  function localizedMemberItem(item) {
    var result = Object.assign({}, item || {});
    var translated = item && item.translations && item.translations[pageLangKey()];
    if (translated && typeof translated === 'object') Object.assign(result, translated);
    return result;
  }
  function memberCreditLabels() {
    var language = pageLangKey();
    if (language === 'en') {
      return { featured: 'Selected Credits', all: 'View all credits', count: ' entries', empty: 'Credits will be updated soon.' };
    }
    if (language === 'jp') {
      return { featured: '主なクレジット', all: 'すべてのクレジットを見る', count: '件', empty: 'クレジットは近日更新予定です。' };
    }
    return { featured: '주요 크레딧', all: '전체 크레딧 보기', count: '개 항목', empty: '크레딧을 준비 중입니다.' };
  }
  function normalizeFeaturedCredits(value) {
    var items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    return items.map(function (item) {
      return String(item || '').replace(/^\s*[-*•]\s*/, '').trim();
    }).filter(Boolean).slice(0, 3);
  }
  function parsedMemberCreditEntries(value) {
    var text = String(value || '');
    var marked = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(function (line) {
      return /^[-*•]\s*\S/.test(line);
    }).map(function (line) {
      return line.replace(/^[-*•]\s*/, '').trim();
    });
    if (marked.length) return marked;
    return text.split(/\n\s*\n/).map(function (block) {
      return block.replace(/^\s*\|\s*[^\n]+\s*/g, '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
  }
  function findOpenMemberContent(modal) {
    var content = liveSiteContent || window.TALETONE_CONTENT;
    if (!content || !Array.isArray(content.members)) return null;
    var brandNode = modal.querySelector('.tt-member-brand');
    var brand = brandNode ? brandNode.textContent.replace(/\s+/g, ' ').trim() : '';
    var match = null;
    content.members.some(function (item) {
      var localized = localizedMemberItem(item);
      var candidates = [localized.brand, localized.name, item && item.brand, item && item.name].map(function (value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
      });
      if (brand && candidates.indexOf(brand) !== -1) {
        match = localized;
        return true;
      }
      return false;
    });
    return match;
  }
  function patchMemberCreditDetails() {
    var modal = document.querySelector('.tt-member-modal');
    if (!modal) return;
    var box = modal.querySelector('.tt-member-credit-box');
    if (!box) return;
    var member = findOpenMemberContent(modal);
    var legacy = box.querySelector('[style*="white-space"]');
    var fullText = String((member && member.creditsText) || (legacy && legacy.textContent) || box.dataset.ttMemberCreditSource || '').trim();
    var allEntries = parsedMemberCreditEntries(fullText);
    var featured = normalizeFeaturedCredits(member && member.featuredCredits);
    if (!featured.length) featured = allEntries.slice(0, 3);
    var labels = memberCreditLabels();
    var fingerprint = [pageLangKey(), fullText, featured.join('\n')].join('::');
    if (box.dataset.ttMemberCreditFingerprint === fingerprint) return;

    box.dataset.ttMemberCreditSource = fullText;
    box.dataset.ttMemberCreditFingerprint = fingerprint;
    box.style.setProperty('--tt-member-accent', String((member && member.accent) || '#0E6E7D'));

    var headingRow = box.previousElementSibling;
    var heading = headingRow && headingRow.firstElementChild;
    if (heading) {
      heading.classList.add('tt-member-credit-heading');
      heading.textContent = labels.featured;
    }

    var list = document.createElement('ol');
    list.className = 'tt-member-featured-list';
    (featured.length ? featured : [labels.empty]).forEach(function (credit, index) {
      var item = document.createElement('li');
      var number = document.createElement('span');
      number.className = 'tt-member-featured-number';
      number.textContent = String(index + 1).padStart(2, '0');
      var copy = document.createElement('p');
      copy.textContent = credit;
      item.append(number, copy);
      list.appendChild(item);
    });

    var details = document.createElement('details');
    details.className = 'tt-member-credit-details';
    var summary = document.createElement('summary');
    var summaryLabel = document.createElement('span');
    summaryLabel.className = 'tt-member-credit-summary-label';
    summaryLabel.textContent = labels.all;
    var count = document.createElement('span');
    count.className = 'tt-member-credit-count';
    count.textContent = String(allEntries.length) + labels.count;
    var arrow = document.createElement('span');
    arrow.className = 'tt-member-credit-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    summary.append(summaryLabel, count, arrow);
    var all = document.createElement('div');
    all.className = 'tt-member-credit-all';
    all.textContent = fullText || labels.empty;
    details.append(summary, all);

    box.replaceChildren(list, details);
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
  // WORKS · the bookshelf
  // Every work is a record sleeve on a shelf. Covers tilt toward the pointer; the play button in the
  // middle slides the record out and spins it; the detail button opens the story in a popup.
  // ===================================================================
  var state = {
    filter: 'all',
    expanded: false,
    playing: false,
    current: -1,      // index into works of the record being played
    track: 0,
    language: 'KR',
    modal: -1,        // index of the work open in the popup
    settled: false    // the shelf has made its entrance once
  };
  var audio = null;
  var progressFrame = 0;

  var shelfLabels = {
    kr: { all: '전체', ost: 'OST', artist: '아티스트', more: '서가 전체 보기', less: '접기', play: '재생', pause: '일시정지', detail: '자세히', open: '이야기 펼치기', nowPlaying: '지금 흐르는 노래', close: '닫기', tracks: '트랙', filters: '작업 분류', mv: 'MV 보기', page: '작업 페이지', credits: '크레딧' },
    en: { all: 'All', ost: 'OST', artist: 'Artists', more: 'Show the whole shelf', less: 'Show less', play: 'Play', pause: 'Pause', detail: 'Details', open: 'Open the story', nowPlaying: 'Now playing', close: 'Close', tracks: 'Tracks', filters: 'Work categories', mv: 'Watch MV', page: 'Work page', credits: 'Credits' },
    jp: { all: 'すべて', ost: 'OST', artist: 'アーティスト', more: '本棚をすべて見る', less: '閉じる', play: '再生', pause: '一時停止', detail: '詳しく', open: '物語をひらく', nowPlaying: '再生中', close: '閉じる', tracks: 'トラック', filters: '作品の分類', mv: 'MVを見る', page: '作品ページ', credits: 'クレジット' }
  };
  function L() { return shelfLabels[pageLangKey()] || shelfLabels.kr; }

  // Category: an explicit `category` in works-data wins; otherwise game / animation work is OST
  // and everything else is an artist release.
  function categoryOf(work) {
    if (work && work.category) return String(work.category);
    var text = [work && work.type, work && work.translations && work.translations.en && work.translations.en.type].join(' ');
    return /게임|애니|ANIMATION|Zenless|붕괴|Star ?Rail|OST|주제곡|\bOP\b|game|anime/i.test(text) ? 'ost' : 'artist';
  }
  function isAlbum(work) { var k = itemKind(work); return k === 'album' || k === 'ep'; }
  function matchesFilter(work, filter) {
    return filter === 'all' || categoryOf(work) === filter;
  }
  function visibleWorks() {
    return works.map(function (work, index) { return { work: work, index: index }; })
      .filter(function (entry) { return matchesFilter(entry.work, state.filter); });
  }
  function shelfStep() {
    if (window.innerWidth <= 1100) return 6;
    return 8;
  }

  function langPrefix() {
    var key = pageLangKey();
    return key === 'en' ? '/en' : key === 'jp' ? '/ja' : '';
  }
  function workHref(work) {
    return work && work.slug ? langPrefix() + '/works/' + encodeURIComponent(work.slug) + '/' : '#c-works';
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

  function coverStyle(unit) {
    var fit = unit.fit === 'contain' ? 'contain' : 'cover';
    var pos = (unit.posX || '50%') + ' ' + (unit.posY || '50%');
    return 'object-fit:' + fit + ';object-position:' + esc(pos);
  }
  function playButton(index, title, extraClass) {
    var labels = L(), on = state.current === index && state.playing;
    return '<button type="button" class="tt-shelf-play' + (extraClass ? ' ' + extraClass : '') + (on ? ' is-playing' : '') + '" data-works-action="play" data-index="' + index + '" aria-label="' + esc((on ? labels.pause : labels.play) + ': ' + title) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span><span class="tt-shelf-eq" aria-hidden="true"><i></i><i></i><i></i></span></button>';
  }

  function filtersHtml() {
    var labels = L();
    return '<div class="tt-shelf-filters" role="group" aria-label="' + esc(labels.filters) + '">' + ['all', 'ost', 'artist'].map(function (key) {
      var count = works.filter(function (work) { return matchesFilter(work, key); }).length;
      if (!count) return '';
      var on = state.filter === key;
      return '<button type="button" class="tt-shelf-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-works-action="filter" data-filter="' + key + '">' + esc(labels[key]) + '<span class="tt-shelf-chip-count">' + count + '</span></button>';
    }).join('') + '</div>';
  }

  function bookHtml(entry, order) {
    var work = entry.work, index = entry.index, labels = L();
    var unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var artist = plainRichText(unit.artist || work.artist || '');
    var story = plainRichText(unit.description || '');
    var format = [work.format || (isAlbum(work) ? 'Album' : 'Single'), yearOf(work)].filter(Boolean).join(' · ');
    var current = state.current === index;
    var eager = order < shelfStep();
    var image = unit.image || work.image || '';
    return '<li class="tt-shelf-book' + (current ? ' is-current' : '') + (current && state.playing ? ' is-playing' : '') + '" data-works-book="' + index + '" style="--i:' + order + '">' +
      '<div class="tt-shelf-cover">' +
        '<span class="tt-shelf-disc" aria-hidden="true" style="--art:url(\'' + esc(image) + '\')"><i></i></span>' +
        '<a class="tt-shelf-cover-link" href="' + esc(workHref(work)) + '" data-works-action="open" data-index="' + index + '" tabindex="-1" aria-hidden="true">' +
          '<img ' + (eager ? 'src' : 'data-src') + '="' + esc(image) + '" alt="" loading="lazy" decoding="async" style="' + coverStyle(unit) + '">' +
          '<span class="tt-shelf-glare"></span>' +
        '</a>' +
        (hasAudio(work) ? playButton(index, title) : '') +
        '<button type="button" class="tt-shelf-detail" data-works-action="open" data-index="' + index + '" aria-label="' + esc(labels.detail + ': ' + title) + '">' + esc(labels.detail) + '<span aria-hidden="true">+</span></button>' +
      '</div>' +
      '<div class="tt-shelf-meta">' +
        '<p class="tt-shelf-format">' + esc(format) + '</p>' +
        '<h3 class="tt-shelf-name"><a href="' + esc(workHref(work)) + '" data-works-action="open" data-index="' + index + '" aria-label="' + esc(title + ' — ' + labels.open) + '">' + esc(title) + '</a></h3>' +
        (artist ? '<p class="tt-shelf-artist">' + esc(artist) + '</p>' : '') +
        (story ? '<p class="tt-shelf-story">' + esc(story) + '</p>' : '') +
      '</div>' +
    '</li>';
  }

  function trackRowsHtml(work, index) {
    if (!work.tracks || work.tracks.length < 2) return '';
    var labels = L();
    return '<div class="tt-shelf-modal-tracks"><p class="tt-shelf-modal-label">' + esc(labels.tracks) + '</p><ol>' + work.tracks.map(function (track, i) {
      var t = localizedUnit(track), on = state.current === index && state.track === i;
      return '<li><button type="button" class="' + (on ? 'is-on' : '') + '" data-works-action="modal-track" data-index="' + index + '" data-track="' + i + '"><span>' + pad(i + 1) + '</span>' + esc(plainRichText(t.title || '')) + '</button></li>';
    }).join('') + '</ol></div>';
  }

  function modalHtml(index) {
    var work = works[index]; if (!work) return '';
    var labels = L(), meta = localizedMeta();
    var unit = localizedUnit(work);
    var title = plainRichText(unit.title || work.title || '');
    var image = unit.image || work.image || '';
    var credits = String(unit.credits || work.credits || '').trim();
    var facts = [[meta.yearLabel, unit.date || work.date], [meta.typeLabel, work.format], [meta.releaseLabel, plainRichText(unit.type || work.type || '')]]
      .filter(function (row) { return row[1]; })
      .map(function (row) { return '<div><dt>' + esc(plainRichText(row[0] || '')) + '</dt><dd>' + esc(row[1]) + '</dd></div>'; }).join('');
    var links = (work.youtube ? '<a class="tt-shelf-modal-link" href="' + esc(work.youtube) + '" target="_blank" rel="noopener">' + esc(labels.mv) + ' <span aria-hidden="true">↗</span></a>' : '') +
      '<a class="tt-shelf-modal-link" href="' + esc(workHref(work)) + '">' + esc(labels.page) + ' <span aria-hidden="true">→</span></a>';
    return '<div class="tt-gh-modal tt-shelf-modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" data-works-action="close-backdrop">' +
      '<div class="tt-gh-modal-panel tt-shelf-modal-panel">' +
        '<button type="button" class="tt-gh-modal-close tt-shelf-modal-close" data-works-action="close" aria-label="' + esc(labels.close) + '">×</button>' +
        '<div class="tt-shelf-modal-art' + (state.current === index && state.playing ? ' is-playing' : '') + '">' +
          '<span class="tt-shelf-disc" aria-hidden="true" style="--art:url(\'' + esc(image) + '\')"><i></i></span>' +
          '<img src="' + esc(image) + '" alt="" style="' + coverStyle(unit) + '">' +
          (hasAudio(work) ? playButton(index, title, 'tt-shelf-modal-play') : '') +
        '</div>' +
        '<div class="tt-shelf-modal-body">' +
          '<p class="tt-shelf-format">' + esc([work.format, yearOf(work)].filter(Boolean).join(' · ')) + '</p>' +
          '<h3 class="tt-shelf-modal-title">' + esc(title) + '</h3>' +
          '<p class="tt-shelf-modal-artist">' + esc(plainRichText(unit.artist || work.artist || '')) + '</p>' +
          (unit.description ? '<p class="tt-shelf-modal-story">' + esc(plainRichText(unit.description)) + '</p>' : '') +
          trackRowsHtml(work, index) +
          '<dl class="tt-shelf-modal-facts">' + facts + '</dl>' +
          '<div class="tt-shelf-modal-links">' + links + '</div>' +
          (credits ? '<details class="tt-shelf-modal-credits"><summary>' + esc(labels.credits) + '</summary><div>' + esc(credits) + '</div></details>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function playerHtml() {
    var labels = L();
    var work = works[state.current];
    if (!work) return '<div class="tt-shelf-player" aria-hidden="true"></div>';
    var unit = localizedUnit(work);
    var variants = variantsFor(work, state.track);
    var playUnit = playableUnit(work, state.track, state.language);
    var trackTitle = work.tracks && work.tracks.length ? plainRichText(localizedUnit(work.tracks[state.track]).title || '') : '';
    var title = plainRichText(unit.title || work.title || '');
    var tracks = work.tracks && work.tracks.length > 1
      ? '<div class="tt-shelf-player-tracks" role="group" aria-label="' + esc(labels.tracks) + '">' + work.tracks.map(function (track, i) {
          return '<button type="button" class="' + (i === state.track ? 'is-on' : '') + '" aria-pressed="' + (i === state.track) + '" data-works-action="track" data-track="' + i + '" title="' + esc(plainRichText(localizedUnit(track).title || '')) + '">' + pad(i + 1) + '</button>';
        }).join('') + '</div>'
      : '';
    var langs = variants.length > 1
      ? '<div class="tt-shelf-player-langs" role="group">' + variants.map(function (version, i) {
          var label = languageLabel(version, i);
          return '<button type="button" class="' + (label === state.language ? 'is-on' : '') + '" aria-pressed="' + (label === state.language) + '" data-works-action="language" data-language="' + esc(label) + '">' + esc(label) + '</button>';
        }).join('') + '</div>'
      : '';
    return '<div class="tt-shelf-player is-open" role="region" aria-label="' + esc(labels.nowPlaying) + '">' +
      '<button type="button" class="tt-shelf-player-cover" data-works-action="open" data-index="' + state.current + '" aria-label="' + esc(labels.detail + ': ' + title) + '"><img src="' + esc(playUnit.image || unit.image || work.image || '') + '" alt=""></button>' +
      '<div class="tt-shelf-player-text"><span class="tt-shelf-player-kicker">' + esc(labels.nowPlaying) + '</span>' +
        '<strong>' + esc(trackTitle || title) + '</strong><span>' + esc(plainRichText(unit.artist || work.artist || '')) + '</span></div>' +
      tracks + langs +
      '<button type="button" class="tt-shelf-player-toggle' + (state.playing ? ' is-playing' : '') + '" data-works-action="toggle" aria-label="' + esc(state.playing ? labels.pause : labels.play) + '"><span class="tt-shelf-play-icon" aria-hidden="true"></span></button>' +
      '<div class="tt-shelf-player-bar" data-works-action="seek" role="slider" aria-label="' + esc(title) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><i></i></div>' +
      '<span class="tt-shelf-player-time">0:00</span>' +
      '<button type="button" class="tt-shelf-player-close" data-works-action="stop" aria-label="' + esc(labels.close) + '">×</button>' +
    '</div>';
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
    '</header>';
  }

  function clientsHtml() {
    if (!logos.length) return '';
    var meta = localizedMeta();
    return '<div class="tt-shelf-clients"><span class="tt-shelf-clients-label">' + esc(plainRichText(meta.collaborationLabel)) + '</span><div class="tt-shelf-clients-row">' +
      logos.map(function (logo) { return '<img src="' + esc(logo.src) + '" alt="' + esc(logo.alt) + '" loading="lazy">'; }).join('') + '</div></div>';
  }

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

  function render(before) {
    if (!root) root = ensureRoot();
    if (!root) return;
    var labels = L();
    var list = visibleWorks();
    var limit = state.expanded ? list.length : Math.min(list.length, shelfStep());
    var more = list.length > shelfStep()
      ? '<button type="button" class="tt-shelf-more" data-works-action="more" aria-expanded="' + state.expanded + '">' + esc(state.expanded ? labels.less : labels.more) + (state.expanded ? '' : '<span>' + (list.length - limit) + '</span>') + '</button>'
      : '';
    root.innerHTML = '<div class="tt-shelf' + (state.settled ? ' is-settled' : '') + '">' + headHtml() + filtersHtml() +
      '<ul class="tt-shelf-grid">' + list.slice(0, limit).map(bookHtml).join('') + '</ul>' + more + clientsHtml() + playerHtml() +
      (state.modal >= 0 ? modalHtml(state.modal) : '') + '</div>';
    mounted = true;
    if (!state.settled) setTimeout(function () { state.settled = true; var shelf = root && root.querySelector('.tt-shelf'); if (shelf) shelf.classList.add('is-settled'); }, 1400);
    bindLazyCovers();
    updateProgress();
    if (before) shuffleFrom(before);
    window.dispatchEvent(new Event('TALETONE_UI_UPDATED'));
  }

  var coverObserver = null;
  function bindLazyCovers() {
    var pending = root ? root.querySelectorAll('img[data-src]') : [];
    if (!pending.length) return;
    if (!('IntersectionObserver' in window)) { pending.forEach(loadCover); return; }
    if (!coverObserver) coverObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { loadCover(entry.target); coverObserver.unobserve(entry.target); } });
    }, { root: document.getElementById('content'), rootMargin: '600px 0px' });
    pending.forEach(function (img) { coverObserver.observe(img); });
  }
  function loadCover(img) {
    if (!img.dataset.src) return;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }

  // ---- the popup: opened and closed in place, the shelf behind it is not rebuilt ----
  function openModal(index, trigger) {
    if (!root || !works[index]) return;
    closeModal(false);
    state.modal = index;
    if (trigger) rememberDialogTrigger(trigger);
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

  // ---- playback: one audio element; tracks and language versions switch in place ----
  function ensureAudioEl() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.6;
    audio.addEventListener('ended', function () { state.playing = false; setMediaStatus('playback', 'ended'); refreshPlaying(); });
    audio.addEventListener('pause', function () { if (state.playing && audio.paused) { state.playing = false; refreshPlaying(); } });
    return audio;
  }
  function loadCurrent(keepTime) {
    var work = works[state.current]; if (!work) return;
    var unit = playableUnit(work, state.track, state.language);
    var src = audioUrl(unit.audio);
    var el = ensureAudioEl();
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
  function resume() {
    var el = ensureAudioEl();
    var attempt = el.play();
    state.playing = true;
    setMediaStatus('playback', 'playing');
    if (attempt && attempt.catch) attempt.catch(function () { state.playing = false; setMediaStatus('playback', 'blocked'); refreshPlaying(); });
    refreshPlaying(true);
    tickProgress();
  }
  function pauseAll() {
    if (audio && !audio.paused) audio.pause();
    if (state.playing) { state.playing = false; setMediaStatus('playback', 'paused'); refreshPlaying(); }
  }
  function stopAll() {
    pauseAll();
    if (audio) { audio.removeAttribute('src'); audio.load(); }
    state.current = -1;
    refreshPlaying(true);
  }
  // Light update: play states, the record sleeves and the player, without rebuilding the shelf
  function refreshPlaying(rebuildPlayer) {
    if (!root) return;
    var labels = L();
    root.querySelectorAll('[data-works-book]').forEach(function (book) {
      var on = Number(book.getAttribute('data-works-book')) === state.current;
      book.classList.toggle('is-current', on);
      book.classList.toggle('is-playing', on && state.playing);
    });
    root.querySelectorAll('.tt-shelf-play').forEach(function (button) {
      var on = Number(button.getAttribute('data-index')) === state.current && state.playing;
      button.classList.toggle('is-playing', on);
      var label = String(button.getAttribute('aria-label') || '').replace(/^[^:]*:\s*/, '');
      button.setAttribute('aria-label', (on ? labels.pause : labels.play) + ': ' + label);
    });
    var art = root.querySelector('.tt-shelf-modal-art');
    if (art) art.classList.toggle('is-playing', state.modal === state.current && state.playing);
    root.querySelectorAll('[data-works-action="modal-track"]').forEach(function (button) {
      button.classList.toggle('is-on', Number(button.getAttribute('data-index')) === state.current && Number(button.getAttribute('data-track')) === state.track);
    });
    var player = root.querySelector('.tt-shelf-player');
    if (player && (rebuildPlayer || !player.classList.contains('is-open'))) {
      var holder = document.createElement('div'); holder.innerHTML = playerHtml();
      player.replaceWith(holder.firstChild);
    } else if (player) {
      var toggle = player.querySelector('.tt-shelf-player-toggle');
      if (toggle) { toggle.classList.toggle('is-playing', state.playing); toggle.setAttribute('aria-label', state.playing ? labels.pause : labels.play); }
    }
    updateProgress();
  }
  function fmt(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(seconds / 60) + ':' + pad(seconds % 60);
  }
  function updateProgress() {
    if (!root || !audio) return;
    var bar = root.querySelector('.tt-shelf-player-bar');
    var time = root.querySelector('.tt-shelf-player-time');
    var p = audio.duration ? audio.currentTime / audio.duration : 0;
    if (bar) { bar.style.setProperty('--p', p.toFixed(4)); bar.setAttribute('aria-valuenow', String(Math.round(p * 100))); }
    if (time) time.textContent = fmt(audio.currentTime) + (audio.duration ? ' / ' + fmt(audio.duration) : '');
  }
  function tickProgress() {
    cancelAnimationFrame(progressFrame);
    var step = function () { updateProgress(); if (state.playing) progressFrame = requestAnimationFrame(step); };
    progressFrame = requestAnimationFrame(step);
  }
  function seekTo(clientX, bar) {
    if (!audio || !audio.duration) return;
    var rect = bar.getBoundingClientRect();
    audio.currentTime = clamp((clientX - rect.left) / rect.width, 0, 1) * audio.duration;
    updateProgress();
  }

  // ---- the sleeves lean toward the pointer, with a glint of light across the cover ----
  var tiltFrame = 0, tiltTarget = null, tiltX = 0, tiltY = 0;
  function onShelfPointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    var cover = event.target && event.target.closest ? event.target.closest('.tt-shelf-cover') : null;
    if (tiltTarget && tiltTarget !== cover) resetTilt(tiltTarget);
    tiltTarget = cover; if (!cover) return;
    tiltX = event.clientX; tiltY = event.clientY;
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(function () {
      tiltFrame = 0;
      if (!tiltTarget) return;
      var r = tiltTarget.getBoundingClientRect();
      var px = clamp((tiltX - r.left) / r.width, 0, 1), py = clamp((tiltY - r.top) / r.height, 0, 1);
      tiltTarget.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
      tiltTarget.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
      tiltTarget.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      tiltTarget.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
  }
  function resetTilt(cover) {
    if (!cover) return;
    cover.style.removeProperty('--rx'); cover.style.removeProperty('--ry');
    cover.style.removeProperty('--gx'); cover.style.removeProperty('--gy');
  }
  function onShelfPointerOut(event) {
    var cover = event.target && event.target.closest ? event.target.closest('.tt-shelf-cover') : null;
    if (!cover || (event.relatedTarget && cover.contains(event.relatedTarget))) return;
    resetTilt(cover); if (tiltTarget === cover) tiltTarget = null;
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
    if (action === 'filter') {
      var before = bookRects();
      state.filter = button.getAttribute('data-filter') || 'all';
      state.expanded = false;
      render(before);
      var chip = root && root.querySelector('[data-filter="' + state.filter + '"]'); if (chip) chip.focus({ preventScroll: true });
    } else if (action === 'more') {
      var beforeMore = bookRects();
      state.expanded = !state.expanded;
      render(beforeMore);
      if (!state.expanded) { var grid = root && root.querySelector('.tt-shelf-grid'); if (grid) grid.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    } else if (action === 'open') {
      event.preventDefault();
      openModal(Number(button.getAttribute('data-index')), button);
    } else if (action === 'close') {
      closeModal();
    } else if (action === 'close-backdrop') {
      if (event.target === button) closeModal();
    } else if (action === 'play') {
      event.preventDefault();
      var index = Number(button.getAttribute('data-index'));
      if (index === state.current && state.playing) pauseAll(); else if (index === state.current) resume(); else playIndex(index);
    } else if (action === 'modal-track') {
      playIndex(Number(button.getAttribute('data-index')), Number(button.getAttribute('data-track')) || 0);
    } else if (action === 'toggle') {
      if (state.playing) pauseAll(); else resume();
    } else if (action === 'stop') {
      stopAll();
    } else if (action === 'track') {
      state.track = Number(button.getAttribute('data-track')) || 0;
      state.language = defaultLanguage(works[state.current], state.track);
      loadCurrent(false); resume();
    } else if (action === 'language') {
      state.language = button.getAttribute('data-language') || state.language;
      var wasPlaying = state.playing;
      loadCurrent(true);
      if (wasPlaying) resume(); else refreshPlaying(true);
    } else if (action === 'seek') {
      seekTo(event.clientX, button);
    }
  }
  function onKey(event) {
    var bar = event.target && event.target.closest ? event.target.closest('.tt-shelf-player-bar') : null;
    if (!bar || !audio || !audio.duration) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      audio.currentTime = clamp(audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5), 0, audio.duration);
      updateProgress();
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
    setTimeout(function () { waitForHost(0); }, 120);
  }
  function setEditorData(json) {
    if (!json || !json.works) return;
    bindWorksInteractions();
    stopAll();
    works = json.works || [];
    logos = json.clientLogos || [];
    state.modal = -1;
    render();
  }
  function selectEditorWork(payload) {
    var index = payload && typeof payload === 'object' ? payload.index : payload;
    var book = root && root.querySelector('[data-works-book="' + Number(index) + '"]');
    if (book) book.scrollIntoView({ block: 'center' });
  }

  var lastWidthStep = 0;
  function onResize() {
    var step = shelfStep();
    if (mounted && step !== lastWidthStep) { lastWidthStep = step; render(); }
  }

  var globalUxState = {
    dialog: null,
    trigger: null,
    triggerDescriptor: null,
    inerted: [],
    menu: null,
    skipLink: null,
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

  function closeMobileChapterMenu(restoreFocus) {
    var progress = document.getElementById('progress');
    if (!document.body || !document.body.classList.contains('tt-mobile-chapter-open')) return;
    document.body.classList.remove('tt-mobile-chapter-open');
    if (progress) progress.setAttribute('aria-expanded', 'false');
    if (restoreFocus && progress) progress.focus({ preventScroll: true });
  }

  function toggleMobileChapterMenu() {
    if (window.innerWidth > 1180 || !document.body || globalUxState.dialog) return;
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

    if (window.innerWidth <= 1180) {
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

  function findSiteDialog() {
    return document.querySelector('.tt-gh-modal[role="dialog"], .tt-member-modal, .tt-news-modal');
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

  function setDialogChromeHidden(hidden) {
    ['brand', 'lang-switcher', 'chapnav', 'progress', 'tt-mobile-chapter-menu'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;

      if (hidden) {
        if (node.dataset.ttDialogChromeHidden !== 'true') {
          node.dataset.ttDialogChromeHidden = 'true';
          node.dataset.ttDialogPrevVisibility = node.style.visibility || '';
          node.dataset.ttDialogPrevPointerEvents = node.style.pointerEvents || '';
          node.dataset.ttDialogPrevAriaHidden = node.hasAttribute('aria-hidden')
            ? (node.getAttribute('aria-hidden') || '')
            : '__missing__';
        }
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
        node.setAttribute('aria-hidden', 'true');
        return;
      }

      if (node.dataset.ttDialogChromeHidden !== 'true') return;
      if (document.body && document.body.classList.contains('tt-network-open')) return;

      node.style.visibility = node.dataset.ttDialogPrevVisibility || '';
      node.style.pointerEvents = node.dataset.ttDialogPrevPointerEvents || '';
      if (node.dataset.ttDialogPrevAriaHidden === '__missing__') node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', node.dataset.ttDialogPrevAriaHidden || '');

      delete node.dataset.ttDialogChromeHidden;
      delete node.dataset.ttDialogPrevVisibility;
      delete node.dataset.ttDialogPrevPointerEvents;
      delete node.dataset.ttDialogPrevAriaHidden;
    });
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
    // the WORKS popup keeps the music going; every other dialog pauses it
    if (state.playing && !dialog.classList.contains('tt-shelf-modal')) pauseAll();
    globalUxState.dialog = dialog;
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
    setDialogChromeHidden(true);
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
    setDialogChromeHidden(false);
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
    patchNewsPreviews();
    patchMemberCreditDetails();
    patchInteractiveCards();
    refreshSiteDialog();
  }

  function onGlobalUxKeydown(event) {
    var target = event.target;
    if ((event.key === 'Enter' || event.key === ' ') && target && target.dataset && target.dataset.ttDialogTrigger === 'true') {
      event.preventDefault();
      rememberDialogTrigger(target);
      target.click();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && target && target.id === 'progress' && window.innerWidth <= 1180) {
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
    window.addEventListener('resize', refreshChapterControls, { passive: true });
    window.addEventListener('TALETONE_UI_UPDATED', refreshGlobalUx);
    globalUxState.chapterObserver = new MutationObserver(refreshChapterControls);
    globalUxState.chapterObserver.observe(document.body, { attributes: true, attributeFilter: ['data-active-chapter'] });
    globalUxState.chapterObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }


  window.TALETONE_WORKS_API = {
    setData: setEditorData,
    setMeta: setMeta,
    select: selectEditorWork,
    pauseAll: function () { pauseAll(); }
  };

  window.addEventListener('TALETONE_CHAPTER_CHANGE', function (event) {
    var chapter = event && event.detail ? event.detail.chapter : '';
    if (!chapter) return;
    if (chapter !== 'works') { pauseAll(); return; }
    if (!mounted) init();
  });

  window.addEventListener('TALETONE_CHAPTER_PRELOAD', function (event) {
    if (!event.detail || event.detail.chapter !== 'works') return;
    var section = document.getElementById('c-works');
    if (section) section.setAttribute('data-chapter-preloaded', '');
    if (!mounted) init();
  });

  window.addEventListener('message', function (event) {
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
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('hashchange', scrollToWorksFromHash);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('pointermove', onShelfPointerMove, { passive: true });
    document.addEventListener('pointerout', onShelfPointerOut, true);
    bindVisibilityPause();
  }
  function start() {
    initGlobalUx();
    if (isWorksChapterActive() || window.parent !== window) init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
