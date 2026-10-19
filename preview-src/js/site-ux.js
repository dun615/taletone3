// Site-wide UX that every chapter uses: the skip link, the compact chapter menu, accessible names for
// member/news cards, dialog focus handling (inert siblings, focus return), and small content patches for
// news previews and member credits. It used to live inside works.js; it has nothing to do with Works.
(function () {
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
    var content = window.TALETONE_CONTENT;
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
    var content = window.TALETONE_CONTENT;
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
      // phones have no language switcher in the top bar; the languages live at the foot of this menu
      var langs = document.createElement('div');
      langs.className = 'tt-mobile-menu-langs';
      langs.setAttribute('role', 'group');
      [['kr', 'KR', '한국어'], ['en', 'EN', 'English'], ['jp', 'JP', '日本語']].forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.lang = item[0];
        button.textContent = item[1];
        button.setAttribute('aria-label', item[2]);
        button.addEventListener('click', function () {
          var source = document.getElementById('lang-' + item[0]);
          closeMobileChapterMenu(false);
          if (source) source.click();
        });
        langs.appendChild(button);
      });
      menu.appendChild(langs);
      document.body.appendChild(menu);
      globalUxState.menu = menu;
    }
    // labels follow the page language
    globalUxState.menu.setAttribute('aria-label', localizedUiLabel('챕터 이동', 'Chapter navigation', 'チャプター移動'));
    globalUxState.menu.querySelectorAll('a[data-nav-id]').forEach(function (link) {
      var source = document.getElementById(link.dataset.navId);
      var label = source && source.querySelector('.nav-label');
      if (label && label.textContent.trim()) link.textContent = label.textContent.trim();
    });
    var langGroup = globalUxState.menu.querySelector('.tt-mobile-menu-langs');
    if (langGroup) {
      langGroup.setAttribute('aria-label', localizedUiLabel('언어', 'Language', '言語'));
      langGroup.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.lang === pageLangKey() ? 'true' : 'false');
      });
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
      // a member without a detail sheet is plain content, not a button
      if (card.getAttribute('data-no-detail') === 'true') {
        ['role', 'tabindex', 'aria-haspopup', 'aria-label'].forEach(function (name) { card.removeAttribute(name); });
        delete card.dataset.ttDialogTrigger;
        return;
      }
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-label', interactiveCardLabel(card, kind));
      card.dataset.ttDialogTrigger = 'true';
    });
  }

  function findSiteDialog() {
    return document.querySelector('.tt-shelf-modal[role="dialog"], .tt-member-modal, .tt-news-modal');
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

  // Phones: a dialog panel can be pulled down to close, like a native sheet. It only follows the finger while
  // the panel is scrolled to its top, so reading further down still scrolls normally.
  function enableSheetDrag(panel, close) {
    if (!panel || !close || panel.dataset.ttSheetDrag) return;
    panel.dataset.ttSheetDrag = 'true';
    var grip = document.createElement('span');
    grip.className = 'tt-sheet-grip';
    grip.setAttribute('aria-hidden', 'true');
    panel.insertBefore(grip, panel.firstChild);
    var startY = null, dy = 0;
    panel.addEventListener('touchstart', function (event) {
      if (window.innerWidth > 760 || event.touches.length !== 1 || panel.scrollTop > 0) { startY = null; return; }
      startY = event.touches[0].clientY; dy = 0;
      panel.style.transition = 'none';
    }, { passive: true });
    panel.addEventListener('touchmove', function (event) {
      if (startY == null) return;
      dy = event.touches[0].clientY - startY;
      if (dy <= 0 || panel.scrollTop > 0) { dy = 0; panel.style.transform = ''; return; }
      if (event.cancelable) event.preventDefault();
      panel.style.transform = 'translateY(' + Math.round(dy * 0.92) + 'px)';
    }, { passive: false });
    panel.addEventListener('touchend', function () {
      if (startY == null) return;
      startY = null;
      panel.style.transition = 'transform .22s ease';
      if (dy > 110) { panel.style.transform = 'translateY(100%)'; setTimeout(function () { close.click(); }, 160); }
      else panel.style.transform = '';
      dy = 0;
    });
  }

  function activateSiteDialog(dialog) {
    if (!dialog || dialog === globalUxState.dialog) return;
    if (globalUxState.dialog) deactivateSiteDialog(false);
    closeMobileChapterMenu(false);
    // the WORKS popup keeps the music going; every other dialog pauses it
    if (!dialog.classList.contains('tt-shelf-modal') && window.TALETONE_WORKS_API) window.TALETONE_WORKS_API.pauseAll();
    globalUxState.dialog = dialog;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');

    var heading = dialog.querySelector('.tt-member-brand, h3');
    if (heading && !dialog.hasAttribute('aria-label')) {
      if (!heading.id) heading.id = 'tt-dialog-title-' + Date.now();
      dialog.setAttribute('aria-labelledby', heading.id);
    }
    var panel = dialog.querySelector('.tt-member-panel, .tt-shelf-modal-panel') || dialog.firstElementChild;
    if (panel) panel.setAttribute('role', 'document');
    var close = dialog.querySelector('.tt-member-close, .tt-shelf-modal-close, .tt-news-close, .tt-x-close, :scope > div > button');
    if (close) {
      close.setAttribute('type', 'button');
      if (!close.getAttribute('aria-label')) close.setAttribute('aria-label', close.textContent.trim() || 'Close');
    }
    enableSheetDrag(panel, close);
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
      var close = dialog.querySelector('.tt-member-close, .tt-shelf-modal-close, .tt-news-close, .tt-x-close, :scope > div > button');
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
        // (the dock's chapter button toggles the menu itself)
        if ((!globalUxState.menu || !globalUxState.menu.contains(event.target)) && (!progress || !progress.contains(event.target)) &&
          !(event.target.closest && event.target.closest('#tt-dock'))) {
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


  window.TALETONE_SITE_UX = { rememberDialogTrigger: rememberDialogTrigger, toggleChapterMenu: toggleMobileChapterMenu, closeChapterMenu: closeMobileChapterMenu };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGlobalUx);
  else initGlobalUx();
})();

// ===== Phones: one dock at the bottom (was preview experiment X1) =====
// Logo, the current chapter (opens the chapter menu) and "문의하기", in reach of the thumb; the top of the
// screen stays clear. works.css shows it at 760px and below only.
(function () {
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  // chapter links stay in the page: the (hidden) chapter nav buttons run the in-app navigation
  function goChapter(id) { var b = document.getElementById(id); if (b) b.click(); }

  ready(function () {
    var dock = document.createElement('nav');
    dock.id = 'tt-dock';
    dock.innerHTML = '<button type="button" class="tt-dock-home"><img src="assets/logo/mark-ink.png" alt=""></button>' +
      '<button type="button" class="tt-dock-chapter" aria-haspopup="menu" aria-controls="tt-mobile-chapter-menu"><span class="tt-dock-num"></span><span class="tt-dock-name"></span><i aria-hidden="true"></i></button>' +
      '<button type="button" class="tt-dock-cta"></button>';
    document.body.appendChild(dock);
    var names = { home: 'nav-0', projects: 'nav-2', members: 'nav-3', works: 'nav-4', news: 'nav-5', contact: 'nav-6' };
    var order = ['home', 'projects', 'members', 'works', 'news', 'contact'];
    var sync = function () {
      var chapter = document.body.getAttribute('data-active-chapter') || 'home';
      var nav = document.getElementById(names[chapter] || 'nav-0');
      var label = nav && nav.querySelector('.nav-label');
      var lang = document.documentElement.lang || 'ko';
      var en = /^en/.test(lang), ja = /^ja/.test(lang);
      dock.setAttribute('aria-label', en ? 'Site dock' : ja ? 'サイトドック' : '사이트 도크');
      dock.querySelector('.tt-dock-home').setAttribute('aria-label', 'HOME');
      dock.querySelector('.tt-dock-num').textContent = String(Math.max(0, order.indexOf(chapter)) + 1).padStart(2, '0');
      dock.querySelector('.tt-dock-name').textContent = label ? label.textContent.trim() : '';
      dock.querySelector('.tt-dock-chapter').setAttribute('aria-label', (en ? 'Chapter menu: ' : ja ? 'チャプターメニュー：' : '챕터 메뉴: ') + (label ? label.textContent.trim() : ''));
      dock.querySelector('.tt-dock-cta').textContent = en ? 'Contact' : ja ? 'お問い合わせ' : '문의하기';
    };
    sync();
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-active-chapter'] });
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    dock.querySelector('.tt-dock-home').addEventListener('click', function () { goChapter('nav-0'); });
    dock.querySelector('.tt-dock-cta').addEventListener('click', function () { goChapter('nav-6'); });
    dock.querySelector('.tt-dock-chapter').addEventListener('click', function (event) {
      event.stopPropagation();
      if (window.TALETONE_SITE_UX && window.TALETONE_SITE_UX.toggleChapterMenu) window.TALETONE_SITE_UX.toggleChapterMenu();
    });

    // /preview/ only: a small readout of this screen's CSS size, to tune layouts for a given phone (e.g. a foldable)
    if (/\/preview(\/|$)/.test(location.pathname)) {
      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'tt-screen-badge';
      var show = function () {
        badge.textContent = window.innerWidth + '×' + window.innerHeight + ' · ' + (Math.round((window.devicePixelRatio || 1) * 100) / 100) + 'x';
      };
      show();
      window.addEventListener('resize', show, { passive: true });
      badge.addEventListener('click', function () { badge.classList.toggle('is-folded'); });
      document.body.appendChild(badge);
    }
  });
})();
