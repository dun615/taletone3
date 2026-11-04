// The lock screen's clock: the visitor's own time.
// clock on the lock screen
// The visitor's own time, as their device shows it: its time zone and its 12- or 24-hour clock (a lock screen
// leaves out AM/PM); the date line in the page's language. It keeps time while the page is open.
{ const loc = { kr: 'ko-KR', en: 'en-US', jp: 'ja-JP' }[LANG];
  let fmt = null; try { fmt = new Intl.DateTimeFormat(navigator.languages && navigator.languages.length ? navigator.languages : undefined, { hour: 'numeric', minute: '2-digit' }); } catch (_) {}
  let shown = '';
  const tick = () => {
    const d = new Date();
    let time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (fmt && fmt.formatToParts) { try { time = fmt.formatToParts(d).filter((x) => x.type !== 'dayPeriod').map((x) => x.value).join('').trim(); } catch (_) {} }
    if (time === shown) return; shown = time; clockEl.textContent = time;
    try { dateEl.textContent = d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' }); } catch (_) {}
  };
  tick(); setInterval(tick, 5000); }
