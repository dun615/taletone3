// The base every other part of src/journey/js/ uses: the data the page carries (window.TT_JOURNEY, from
// scripts/journey-data.mjs), the story's timeline, and small helpers. The parts run in file-name order in one scope
// (scripts/build.mjs joins them into assets/journey/journey.js); ARCHITECTURE.md maps them.
//
// The story, by scroll position u (0 to TOTAL; CH below):
//   pro     the back of a phone turns over to its lock screen and an invitation; "enter" breaks the film up, the room
//           goes dark, points gather into the land and the visitor is drawn in (ENTER)
//   tale    the about, all on one screen over the land, which runs by itself (a line past poles, round and round);
//           its button goes on: a phone comes along the line, and its screen (the sea) grows to fill the view
//   tone    the philosophy over the sea (straight down past jellyfish of light, round and round); its button goes on:
//           a phone comes up the line, and through it is space
//   case    a real project over space (star to star, round and round); its button goes on along the stars to the record
//   music   the record: found
//   record  the staff swirls into a 3D current with every work on it; an album lets its tracks out on a cord
//   done    the record goes into the phone (the letter)
//   epi     the only dark place: one seat is still empty; the visitor writes it (the inquiry)
// Each chapter's words and its world are apart: the words are read at the visitor's pace, the world runs at its own
// (51-stage-loops).

const DATA = window.TT_JOURNEY;
const COPY = DATA.copy, WORKS = DATA.works, EXTRAS = DATA.extras || [];
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
// (each story chapter: its words, then its way on into the next world)
const CH = { pro: [0, 1], tale: [1, 3.6], tone: [3.6, 6.2], case: [6.2, 8.8], music: [8.8, 10.4], record: [10.4, 14.4], done: [14.4, 15.3], epi: [15.3, 16.3] };
const TOTAL = 16.3;
// (where a story chapter's words are read from: just past its start, where the scenes into it stop)
const READ0 = 0.02;
/* The things of each world the line passes, in its depth z: eight poles on the land, eight jellyfish of light in the
   sea, eight stars in space. Every other one (the 1st, 3rd, 5th, 7th: SET) is where one of the chapter's words
   belongs, which tells 54-stage-conversation which chapter a message is in. */
const OBJ = { land: Array.from({ length: 8 }, (_, k) => 3.6 + 1.8 * k) };
const CL0 = OBJ.land[7], ZS = CL0 + 3; // the line lifts off the last pole; where the sky becomes the sea
OBJ.sea = Array.from({ length: 8 }, (_, k) => ZS + 2.6 + 2.6 * k);
const S0 = ZS + 22.5; // where the deep opens onto space
OBJ.space = Array.from({ length: 8 }, (_, k) => S0 + 4.5 + 1.6 * k);
const SET = { land: OBJ.land.filter((_, i) => i % 2 === 0), sea: OBJ.sea.filter((_, i) => i % 2 === 0), space: OBJ.space.filter((_, i) => i % 2 === 0) };
const PEN = { tale: [2, CL0 + 1], tone: [CL0 + 1, S0], case: [S0, S0 + 17], music: [S0 + 17, S0 + 29] };
// the phone between worlds (58-stage-phone-passage), by the way's progress: where it rests, where it has woken
const PH_HOLD = 0.45, PH_WAKE = 0.62;
const FLOW_DOTS = { wide: 260, narrow: 120 };    // Record: specks drifting along the current
const INK = '20,28,48';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const html = document.documentElement, body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// with script, every screen gets the stage; narrow and upright screens get its narrow layout (NARROW, 44-stage-state)
const LANG = body.dataset.lang || 'kr';
const BASE = body.dataset.base || '';
const ASSET = body.dataset.assets || '/';
const bySlug = Object.fromEntries(WORKS.map((w) => [w.slug, w]));
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const local = (u, c) => (u - CH[c][0]) / (CH[c][1] - CH[c][0]);
// the scroll position where the pen is at z (the tale holds the pen still over its first 8%)
const uOfPen = (z) => { for (const k of ['tale', 'tone', 'case', 'music']) { const [a, b] = PEN[k]; if (z <= b || k === 'music') { let l = Math.min(1, Math.max(0, (z - a) / (b - a))); if (k === 'tale') l = 0.08 + 0.92 * l; return CH[k][0] + l * (CH[k][1] - CH[k][0]); } } return 0; };
const on = (el, v) => el && el.classList.toggle('on', !!v);

html.classList.add('jy-stage-mode');
