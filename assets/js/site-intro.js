(function () {
  'use strict';

  var intro = document.getElementById('tt-site-intro');
  if (!intro) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var duration = reduceMotion ? 560 : 2450;
  var finishDelay = duration + (reduceMotion ? 80 : 70);
  var done = false;
  var finishTimer = 0;
  var body = document.body;
  var skipButton = intro.querySelector('.tt-intro-skip');
  var objectsLayer = intro.querySelector('.tt-intro-objects');
  var rushLayer = intro.querySelector('.tt-intro-rush');
  var motesLayer = intro.querySelector('.tt-intro-motes');
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  var seed = 7302019;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function range(min, max) {
    return min + (max - min) * random();
  }

  function appendStoryObjects() {
    if (!objectsLayer || reduceMotion) return;
    var kinds = ['note', 'page', 'drop', 'star', 'ring', 'glyph'];
    var count = isMobile ? 11 : 15;
    for (var i = 0; i < count; i += 1) {
      var object = document.createElement('i');
      var side = i % 2 === 0 ? -1 : 1;
      var spread = range(6, isMobile ? 39 : 46) * side;
      var rise = -range(isMobile ? 58 : 64, isMobile ? 104 : 118);
      object.className = 'tt-intro-story-object';
      object.dataset.kind = kinds[i % kinds.length];
      object.style.setProperty('--size', range(isMobile ? 13 : 15, isMobile ? 28 : 34).toFixed(1) + 'px');
      object.style.setProperty('--tx', spread.toFixed(1) + 'vw');
      object.style.setProperty('--ty', rise.toFixed(1) + 'vh');
      object.style.setProperty('--rz', range(-155, 155).toFixed(1) + 'deg');
      object.style.setProperty('--zoom', range(1.05, 2.45).toFixed(2));
      object.style.setProperty('--delay', range(420, 680).toFixed(0) + 'ms');
      object.style.setProperty('--flight', range(1050, 1450).toFixed(0) + 'ms');
      objectsLayer.appendChild(object);
    }
  }

  function appendRushLines() {
    if (!rushLayer || reduceMotion) return;
    var count = isMobile ? 20 : 34;
    for (var i = 0; i < count; i += 1) {
      var line = document.createElement('i');
      line.className = 'tt-intro-rush-line';
      line.style.setProperty('--x', range(2, 98).toFixed(1) + '%');
      line.style.setProperty('--w', range(.7, 2.3).toFixed(1) + 'px');
      line.style.setProperty('--len', range(7, 22).toFixed(1) + 'vh');
      line.style.setProperty('--lean', range(-4, 4).toFixed(1) + 'deg');
      line.style.setProperty('--blur', range(0, 1.1).toFixed(1) + 'px');
      line.style.setProperty('--speed', range(520, 850).toFixed(0) + 'ms');
      line.style.setProperty('--delay', range(780, 1350).toFixed(0) + 'ms');
      rushLayer.appendChild(line);
    }
  }

  function appendMotes() {
    if (!motesLayer || reduceMotion) return;
    var count = isMobile ? 15 : 24;
    for (var i = 0; i < count; i += 1) {
      var mote = document.createElement('i');
      mote.className = 'tt-intro-mote';
      mote.style.setProperty('--x', range(4, 96).toFixed(1) + '%');
      mote.style.setProperty('--y', range(18, 74).toFixed(1) + '%');
      mote.style.setProperty('--s', range(1.5, 5.2).toFixed(1) + 'px');
      mote.style.setProperty('--drift', range(-40, 40).toFixed(1) + 'px');
      mote.style.setProperty('--speed', range(750, 1200).toFixed(0) + 'ms');
      mote.style.setProperty('--delay', range(600, 1250).toFixed(0) + 'ms');
      motesLayer.appendChild(mote);
    }
  }

  function announceEnd() {
    try {
      window.dispatchEvent(new CustomEvent('TALETONE_INTRO_END'));
    } catch (_error) {
      window.dispatchEvent(new Event('TALETONE_INTRO_END'));
    }
  }

  function cleanup() {
    window.removeEventListener('keydown', onKeydown);
    window.setTimeout(function () {
      if (objectsLayer) objectsLayer.replaceChildren();
      if (rushLayer) rushLayer.replaceChildren();
      if (motesLayer) motesLayer.replaceChildren();
    }, 320);
  }

  function finish(immediate) {
    if (done) return;
    done = true;
    window.clearTimeout(finishTimer);
    body.classList.remove('tt-intro-lock');

    if (immediate) {
      intro.classList.add('is-skipping');
      window.setTimeout(function () {
        intro.classList.add('is-done');
        announceEnd();
        cleanup();
      }, 245);
      return;
    }

    intro.classList.add('is-done');
    announceEnd();
    cleanup();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') finish(true);
  }

  if (new URLSearchParams(window.location.search).get('intro') === '0') {
    finish(false);
    return;
  }

  appendStoryObjects();
  appendRushLines();
  appendMotes();

  body.classList.add('tt-intro-lock');
  window.addEventListener('keydown', onKeydown, { passive: true });
  if (skipButton) {
    skipButton.addEventListener('click', function () {
      finish(true);
    });
  }

  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      intro.classList.add('is-running');
      finishTimer = window.setTimeout(function () {
        finish(false);
      }, finishDelay);
    });
  });

  window.TALETONE_INTRO = {
    skip: function () {
      finish(true);
    },
    isActive: function () {
      return !done;
    }
  };
}());
