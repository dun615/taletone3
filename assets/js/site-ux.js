// Site-wide UX that every chapter uses: the skip link, the compact chapter menu, dialog focus handling (inert
// siblings, focus return), and small content patches for member credits. It used to live inside works.js; it has nothing to do with Works.
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
      projects: 'nav-2',
      members: 'nav-3',
      works: 'nav-4',
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
      projects: 'c-projects',
      members: 'c-members',
      works: 'c-works',
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

  function findSiteDialog() {
    return document.querySelector('.tt-shelf-modal[role="dialog"], .tt-member-modal');
  }

  function setSiblingsInert(dialog, kept) {
    globalUxState.inerted = [];
    var current = dialog;
    while (current && current.parentElement && current.parentElement !== document.body) {
      Array.prototype.forEach.call(current.parentElement.children, function (sibling) {
        if (sibling === current || sibling === kept || sibling.nodeType !== 1 || sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') return;
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

  // on desktop a works popup leaves the language switcher usable, so the popup can be read in another language
  function keptChrome(dialog) {
    var keep = dialog && dialog.matches('.tt-shelf-modal') && window.matchMedia('(min-width: 861px)').matches;
    return keep ? document.getElementById('lang-switcher') : null;
  }

  function setDialogChromeHidden(hidden, kept) {
    ['brand', 'lang-switcher', 'chapnav', 'progress', 'tt-mobile-chapter-menu'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node || (hidden && node === kept)) return;

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
    var close = dialog.querySelector('.tt-member-close, .tt-shelf-modal-close, .tt-x-close, :scope > div > button');
    if (close) {
      close.setAttribute('type', 'button');
      if (!close.getAttribute('aria-label')) close.setAttribute('aria-label', close.textContent.trim() || 'Close');
    }
    var kept = keptChrome(dialog);
    setDialogChromeHidden(true, kept);
    setSiblingsInert(dialog, kept);
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

  // Images further down (img[data-defer-src]: client logos, the planning sheet) wait for the reader's first input,
  // or for a page opened on a chapter other than home, so the opening view fetches no more than before.
  // Scrolling alone does not count: the intro glide scrolls #content by itself.
  var deferredReady = false;
  function loadDeferredImages() {
    if (!deferredReady && /\/(story-types|members|works|news|contact)\/?$/.test(location.pathname)) deferredReady = true;
    if (!deferredReady) return;
    document.querySelectorAll('img[data-defer-src]').forEach(function (image) {
      image.src = image.getAttribute('data-defer-src');
      image.removeAttribute('data-defer-src');
    });
  }
  function releaseDeferredImages() {
    if (deferredReady) return;
    deferredReady = true;
    loadDeferredImages();
  }
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (type) { window.addEventListener(type, releaseDeferredImages, { passive: true, once: true }); });

  function refreshGlobalUx() {
    refreshChapterControls();
    ensureSkipLink();
    refreshSiteDialog();
    loadDeferredImages();
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
      var close = dialog.querySelector('.tt-member-close, .tt-shelf-modal-close, .tt-x-close, :scope > div > button');
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
    var names = { home: 'nav-0', projects: 'nav-2', members: 'nav-3', works: 'nav-4', contact: 'nav-6' };
    var order = ['home', 'members', 'projects', 'works', 'contact'];
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
