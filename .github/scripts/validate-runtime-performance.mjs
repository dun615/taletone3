import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) errors.push(message); };
const isGoogleFontRequest = (url) => /^https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/|$)/i.test(url);

const viewports = [
  { key: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { key: 'mobile', width: 390, height: 844, dpr: 3, mobile: true },
];
const functionalViewports = [
  viewports[0],
  { key: 'tablet', width: 820, height: 1180, dpr: 2, mobile: true },
  viewports[1],
];

const pages = [
  {
    key: 'home', path: '/', coldWaitMs: 7_000, warmWaitMs: 2_500,
    // Runs #54-#56 measured 16 first-party requests and 20-23 Google Fonts requests on Linux.
    maxFirstPartyRequests: 18, maxGoogleFontRequests: 30,
    maxTransferBytes: 1_200_000, maxCls: 0.08,
    maxFcpMs: 2_000, maxLcpMs: 6_000, maxLongTasks: 45, maxDomNodes: 1_500,
  },
  {
    key: 'works', path: '/works/', coldWaitMs: 3_500, warmWaitMs: 2_000,
    // Runs #54-#56 measured 28 first-party requests and up to 27 Google Fonts requests on Linux.
    maxFirstPartyRequests: 30, maxGoogleFontRequests: 30,
    maxTransferBytes: 2_800_000, maxCls: 0.08,
    maxFcpMs: 2_000, maxLcpMs: 3_000, maxLongTasks: 12, maxDomNodes: 2_000,
  },
];

const functionalRoutes = [
  { key: 'home', path: '/', chapter: 'home', section: '#c-home' },
  { key: 'story-types', path: '/story-types/', chapter: 'projects', section: '#c-projects' },
  { key: 'members', path: '/members/', chapter: 'members', section: '#c-members' },
  { key: 'works', path: '/works/', chapter: 'works', section: '#c-works' },
  { key: 'news', path: '/news/', chapter: 'news', section: '#c-news' },
  { key: 'contact', path: '/contact/', chapter: 'contact', section: '#c-contact' },
];
const functionalLanguages = { kr: 'ko', en: 'en', jp: 'ja' };

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.avif', 'image/avif'], ['.gif', 'image/gif'],
  ['.woff2', 'font/woff2'], ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const relative = pathname.replace(/^\/+/, '');
      const absolute = path.resolve(root, relative || 'index.html');
      if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(absolute);
      if (!info.isFile()) throw new Error('not a file');
      const body = await readFile(absolute);
      const extension = path.extname(absolute).toLowerCase();
      const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
      const baseHeaders = {
        'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
        'Cache-Control': 'public, max-age=60',
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      };
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, baseHeaders).end();
        return;
      }
      const compressible = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.webmanifest']).has(extension);
      const gzip = compressible && /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers['accept-encoding'] || '');
      const responseBody = gzip ? gzipSync(body, { level: 9 }) : body;
      response.writeHead(200, {
        ...baseHeaders,
        'Content-Length': responseBody.length,
        ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
      });
      if (request.method === 'HEAD') response.end();
      else response.end(responseBody);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === 'win32' && path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'win32' && path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'win32' && path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try PATH below */ }
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return command;
  }
  throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
}

async function launchChrome(chromePath) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'taletone-runtime-'));
  const args = [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-default-apps', '--disable-dev-shm-usage',
    '--disable-features=Translate,MediaRouter', '--no-first-run', '--no-default-browser-check',
    '--no-sandbox', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ];
  const child = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8_000); });
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = 0;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Chrome exited early (${child.exitCode}): ${stderr}`);
    try {
      const contents = await readFile(portFile, 'utf8');
      port = Number(contents.split(/\r?\n/)[0]);
      if (port) break;
    } catch { /* Chrome has not written the port yet. */ }
    await sleep(50);
  }
  if (!port) throw new Error(`Chrome debugging port did not become ready: ${stderr}`);
  return {
    child, profile, port,
    async close() {
      if (child.exitCode == null) {
        try {
          const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
          const browserClient = new CdpClient(version.webSocketDebuggerUrl);
          await browserClient.ready;
          await browserClient.send('Browser.close');
          browserClient.close();
        } catch { child.kill(); }
      }
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        sleep(3_000),
      ]);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try { await rm(profile, { recursive: true, force: true }); break; }
        catch (error) {
          if (attempt === 19) throw error;
          await sleep(100);
        }
      }
    },
  };
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  waitFor(method, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const remove = this.on(method, (params) => {
        clearTimeout(timer);
        remove();
        resolve(params);
      });
      const timer = setTimeout(() => {
        remove();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
    });
  }

  close() { this.socket.close(); }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Runtime.evaluate failed');
  return response.result?.value;
}

function capturePhase(client, origin) {
  const requests = new Map();
  const runtimeErrors = [];
  const remove = [
    client.on('Network.requestWillBeSent', ({ requestId, request, type }) => {
      if (!/^https?:/i.test(request.url)) return;
      requests.set(requestId, { url: request.url, type: type || 'Other', bytes: 0, status: 0, failed: false });
    }),
    client.on('Network.responseReceived', ({ requestId, response, type }) => {
      const item = requests.get(requestId);
      if (!item) return;
      item.type = type || item.type;
      item.status = response.status;
      item.fromCache = !!(response.fromDiskCache || response.fromPrefetchCache || response.fromServiceWorker);
    }),
    client.on('Network.requestServedFromCache', ({ requestId }) => {
      const item = requests.get(requestId);
      if (item) item.fromCache = true;
    }),
    client.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
      const item = requests.get(requestId);
      if (item) item.bytes = Math.max(0, encodedDataLength || 0);
    }),
    client.on('Network.loadingFailed', ({ requestId, errorText, canceled }) => {
      const item = requests.get(requestId);
      if (item && !canceled) { item.failed = true; item.errorText = errorText; }
    }),
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails?.text || 'uncaught exception')),
    client.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type === 'error' || type === 'assert') runtimeErrors.push(args?.map((arg) => arg.value || arg.description || '').join(' ') || `console.${type}`);
    }),
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level !== 'error') return;
      if (entry.source === 'network' && entry.url && !entry.url.startsWith(origin)) return;
      runtimeErrors.push(entry.text || 'browser log error');
    }),
  ];
  return {
    finish() {
      remove.forEach((unsubscribe) => unsubscribe());
      const list = [...requests.values()];
      const byType = {};
      const byOrigin = {};
      for (const request of list) byType[request.type] = (byType[request.type] || 0) + request.bytes;
      for (const request of list) {
        const requestOrigin = new URL(request.url).origin;
        byOrigin[requestOrigin] = (byOrigin[requestOrigin] || 0) + 1;
      }
      const uncachedRequests = list
        .filter((request) => !request.fromCache && request.bytes > 0)
        .sort((a, b) => b.bytes - a.bytes)
        .map(({ url, type, bytes }) => ({ url, type, bytes }));
      const firstPartyRequestCount = list.filter((request) => request.url.startsWith(origin)).length;
      const googleFontRequestCount = list.filter((request) => isGoogleFontRequest(request.url)).length;
      const unexpectedThirdPartyUrls = [...new Set(list
        .filter((request) => !request.url.startsWith(origin) && !isGoogleFontRequest(request.url))
        .map((request) => request.url))];
      return {
        requestCount: list.length,
        firstPartyRequestCount,
        googleFontRequestCount,
        unexpectedThirdPartyUrls,
        transferBytes: list.reduce((sum, request) => sum + (request.fromCache ? 0 : request.bytes), 0),
        resourceBytes: list.reduce((sum, request) => sum + request.bytes, 0),
        uncachedRequests,
        byType,
        byOrigin,
        worksDataRequests: list.filter((request) => /\/assets\/data\/works-data\.json(?:[?#]|$)/.test(request.url)).length,
        audioRequests: list.filter((request) => /\.mp3(?:[?#]|$)/i.test(request.url)).length,
        audioUrls: list.filter((request) => /\.mp3(?:[?#]|$)/i.test(request.url)).map((request) => request.url),
        sameOriginFailures: list.filter((request) => request.url.startsWith(origin) && (request.failed || request.status >= 400)).map((request) => `${request.status || 0} ${request.url}`),
        runtimeErrors: [...new Set(runtimeErrors)],
      };
    },
  };
}

const observerScript = `(() => {
  window.__ttRuntimePerf = { cls: 0, shifts: [], lcp: 0, longTasks: 0, longTaskDuration: 0, errors: [] };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const sources = (entry.sources || []).map(({ node }) => {
          if (!node) return 'unknown';
          if (node.id) return '#' + node.id;
          const classes = node.classList ? [...node.classList].slice(0, 3) : [];
          return (node.tagName || 'unknown').toLowerCase() + (classes.length ? '.' + classes.join('.') : '');
        });
        __ttRuntimePerf.cls += entry.value;
        __ttRuntimePerf.shifts.push({ value: entry.value, sources });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try { new PerformanceObserver((list) => { for (const e of list.getEntries()) __ttRuntimePerf.lcp = Math.max(__ttRuntimePerf.lcp, e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver((list) => { for (const e of list.getEntries()) { __ttRuntimePerf.longTasks += 1; __ttRuntimePerf.longTaskDuration += e.duration; } }).observe({ type: 'longtask', buffered: true }); } catch {}
  addEventListener('error', (event) => __ttRuntimePerf.errors.push(event.message || 'window error'));
  addEventListener('unhandledrejection', (event) => __ttRuntimePerf.errors.push(String(event.reason || 'unhandled rejection')));
})();`;

async function snapshot(client) {
  return evaluate(client, `(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
    const perf = window.__ttRuntimePerf || {};
    const content = document.querySelector('#content');
    return {
      domContentLoaded: nav.domContentLoadedEventEnd || 0,
      fcp: paints['first-contentful-paint'] || 0,
      lcp: perf.lcp || 0,
      cls: perf.cls || 0,
      shifts: perf.shifts || [],
      longTasks: perf.longTasks || 0,
      longTaskDuration: perf.longTaskDuration || 0,
      domNodes: document.getElementsByTagName('*').length,
      chapter: document.body.getAttribute('data-active-chapter') || '',
      worksCards: document.querySelectorAll('[data-works-card]').length,
      memberImagesAssigned: document.querySelectorAll('#c-members .tt-member-card img[src]').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      homeTop: document.querySelector('#c-home')?.getBoundingClientRect().top ?? null,
      contentScrollTop: content?.scrollTop ?? null,
      observerErrors: perf.errors || [],
    };
  })()`);
}

async function performanceMetrics(client) {
  const response = await client.send('Performance.getMetrics');
  return Object.fromEntries((response.metrics || []).map(({ name, value }) => [name, value]));
}

async function navigateAndMeasure(client, url, waitMs, origin) {
  const capture = capturePhase(client, origin);
  const loaded = client.waitFor('Page.loadEventFired');
  const navigation = await client.send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
  await loaded;
  await sleep(waitMs);
  const pageSnapshot = await snapshot(client);
  return { ...capture.finish(), ...pageSnapshot };
}

async function reloadAndMeasure(client, waitMs, origin) {
  const capture = capturePhase(client, origin);
  const loaded = client.waitFor('Page.loadEventFired');
  await client.send('Page.reload', { ignoreCache: false });
  await loaded;
  await sleep(waitMs);
  const pageSnapshot = await snapshot(client);
  return { ...capture.finish(), ...pageSnapshot };
}

async function runCase(chrome, origin, page, viewport) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  try {
    await Promise.all([
      client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable'),
      client.send('Performance.enable'), client.send('Log.enable'),
    ]);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr, mobile: viewport.mobile,
    });
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: observerScript });
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    await client.send('Network.clearBrowserCache');
    const url = `${origin}${page.path}?runtime-performance=1`;
    const cold = await navigateAndMeasure(client, url, page.coldWaitMs, origin);

    let idle = null;
    if (page.key === 'home' && viewport.key === 'mobile') {
      const before = await performanceMetrics(client);
      await sleep(3_000);
      const after = await performanceMetrics(client);
      idle = {
        seconds: 3,
        taskDuration: (after.TaskDuration || 0) - (before.TaskDuration || 0),
        scriptDuration: (after.ScriptDuration || 0) - (before.ScriptDuration || 0),
        recalcStyleCount: (after.RecalcStyleCount || 0) - (before.RecalcStyleCount || 0),
        recalcStyleDuration: (after.RecalcStyleDuration || 0) - (before.RecalcStyleDuration || 0),
        layoutCount: (after.LayoutCount || 0) - (before.LayoutCount || 0),
      };
    }

    const warm = await reloadAndMeasure(client, page.warmWaitMs, origin);
    return { key: `${page.key}-${viewport.key}`, page, viewport, cold, warm, idle };
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {});
  }
}

async function runFunctionalMatrix(chrome, origin) {
  const checked = [];
  for (const viewport of functionalViewports) {
    const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    try {
      await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable'), client.send('Log.enable')]);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr, mobile: viewport.mobile,
      });
      await client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `${observerScript};try{sessionStorage.setItem('tt_intro_home_v5','1')}catch{}`,
      });
      await client.send('Network.setCacheDisabled', { cacheDisabled: false });
      for (const route of functionalRoutes) {
        for (const [language, documentLanguage] of Object.entries(functionalLanguages)) {
          const key = `${route.key}-${language}-${viewport.key}`;
          const capture = capturePhase(client, origin);
          const loaded = client.waitFor('Page.loadEventFired');
          const navigation = await client.send('Page.navigate', { url: `${origin}${route.path}?lang=${language}&functional-smoke=1` });
          if (navigation.errorText) throw new Error(`${key}: navigation failed: ${navigation.errorText}`);
          await loaded;
          await sleep(route.key === 'works' ? 1_300 : 850);
          const state = await evaluate(client, `(() => {
            const section = document.querySelector(${JSON.stringify(route.section)});
            const rect = section && section.getBoundingClientRect();
            const content = document.querySelector('#content');
            const broken = [...document.images].filter((image) => {
              const box = image.getBoundingClientRect();
              const visible = box.bottom >= 0 && box.top <= innerHeight;
              return visible && image.complete && image.naturalWidth === 0 && image.currentSrc;
            }).map((image) => image.currentSrc);
            return {
              lang: document.documentElement.lang,
              chapter: document.body.getAttribute('data-active-chapter') || '',
              sectionTop: rect ? rect.top : null,
              textLength: section ? section.innerText.trim().length : 0,
              worksCards: document.querySelectorAll('[data-works-card]').length,
              memberImagesAssigned: document.querySelectorAll('#c-members .tt-member-card img[src]').length,
              memberImagesDeferred: document.querySelectorAll('#c-members .tt-member-card img[data-member-src]').length,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              broken,
              langButton: !!document.querySelector('#lang-${language}'),
              title: document.title,
              observerErrors: window.__ttRuntimePerf?.errors || [],
            };
          })()`);
          const network = capture.finish();
          assert(state.lang === documentLanguage, `${key}: document lang ${state.lang} != ${documentLanguage}`);
          assert(state.chapter === route.chapter, `${key}: active chapter ${state.chapter} != ${route.chapter}`);
          assert(state.sectionTop != null && Math.abs(state.sectionTop) <= 220, `${key}: direct-route section top is ${state.sectionTop}`);
          assert(state.textLength > 20 && state.title, `${key}: route content is missing`);
          assert(!state.overflow, `${key}: horizontal overflow detected`);
          assert(state.broken.length === 0, `${key}: broken visible images: ${state.broken.join(', ')}`);
          assert(state.langButton, `${key}: language button is missing`);
          assert(network.sameOriginFailures.length === 0, `${key}: network errors: ${network.sameOriginFailures.join(', ')}`);
          assert(network.runtimeErrors.length === 0 && state.observerErrors.length === 0, `${key}: runtime errors: ${[...network.runtimeErrors, ...state.observerErrors].join(' | ')}`);
          if (route.key === 'members') {
            assert(state.memberImagesAssigned === 4 && state.memberImagesDeferred === 0, `${key}: member images were not activated on entry`);
          } else {
            assert(state.memberImagesAssigned === 0 && state.memberImagesDeferred === 4, `${key}: hidden member images were activated`);
          }
          if (route.key === 'works') {
            assert(state.worksCards === 21, `${key}: expected 21 WORKS cards, found ${state.worksCards}`);
            assert(network.worksDataRequests === 1, `${key}: expected one WORKS data request, found ${network.worksDataRequests}`);
          } else {
            assert(network.worksDataRequests === 0, `${key}: hidden WORKS data was requested`);
          }
          checked.push(key);
        }
      }
    } finally {
      client.close();
      await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {});
    }
  }
  return checked;
}

async function clickSelector(client, selector) {
  const point = await evaluate(client, `(async () => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Interaction target not found: ${selector}`);
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function pressKey(client, key, code, virtualKeyCode) {
  const params = { key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...params });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}

async function navigateForInteraction(client, url, waitMs = 900) {
  const loaded = client.waitFor('Page.loadEventFired');
  const navigation = await client.send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(`Interaction navigation failed: ${navigation.errorText}`);
  await loaded;
  await sleep(waitMs);
}

async function runInteractionSmoke(chrome, origin) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  const passed = [];
  try {
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable'), client.send('Log.enable')]);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `${observerScript};try{sessionStorage.setItem('tt_intro_home_v5','1')}catch{}`,
    });
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    const capture = capturePhase(client, origin);

    await navigateForInteraction(client, `${origin}/works/?lang=kr&runtime-interaction=1`, 1_300);
    const worksReady = await evaluate(client, `(() => ({
      chapter: document.body.getAttribute('data-active-chapter'),
      cards: document.querySelectorAll('[data-works-card]').length,
      showcase: document.querySelector('#tt-gh-tab-showcase')?.getAttribute('aria-selected'),
      play: !!document.querySelector('#tt-gh-works-app [data-works-action="play"]'),
      playback: document.body.dataset.ttMediaPlayback || 'paused'
    }))()`);
    assert(worksReady.chapter === 'works' && worksReady.cards === 21 && worksReady.showcase === 'true' && worksReady.play, 'interaction: WORKS Showcase did not initialize');
    assert(worksReady.playback !== 'playing', 'interaction: WORKS audio started without user playback');

    await clickSelector(client, '#tt-gh-works-app [data-works-action="play"]');
    await sleep(1_000);
    const playing = await evaluate(client, `(() => ({
      playback: document.body.dataset.ttMediaPlayback,
      engine: document.body.dataset.ttMediaAudioEngine,
      button: document.querySelector('#tt-gh-works-app [data-works-action="play"]')?.textContent.trim()
    }))()`);
    assert(playing.playback === 'playing', `interaction: WORKS playback state is ${playing.playback || 'missing'}`);
    passed.push('works-play');

    await clickSelector(client, '#tt-gh-tab-gallery[data-works-action="mode"][data-mode="gallery"]');
    await sleep(80);
    const gallery = await evaluate(client, `(() => ({
      playback: document.body.dataset.ttMediaPlayback,
      selected: document.querySelector('#tt-gh-tab-gallery')?.getAttribute('aria-selected'),
      cards: document.querySelectorAll('#tt-gh-panel-gallery [data-works-action="gallery-open"][data-index]').length,
      play: !!document.querySelector('#tt-gh-works-app [data-works-action="play"]')
    }))()`);
    assert(gallery.playback === 'paused' && gallery.selected === 'true', 'interaction: Gallery did not synchronously pause Showcase audio');
    assert(gallery.cards === 21 && !gallery.play, `interaction: Gallery expected 21 cards without a Play control, found ${gallery.cards}`);
    passed.push('works-gallery-pause');

    await clickSelector(client, '#tt-gh-panel-gallery [data-works-action="gallery-open"][data-index="0"]');
    await sleep(120);
    const worksDialogOpen = await evaluate(client, `!!document.querySelector('.tt-gh-modal[role="dialog"][aria-modal="true"]') && document.body.classList.contains('tt-site-dialog-open')`);
    assert(worksDialogOpen, 'interaction: WORKS Gallery dialog did not open');
    await clickSelector(client, '.tt-gh-modal .tt-gh-modal-close[data-works-action="modal-close"]');
    await sleep(120);
    const worksDialogClosed = await evaluate(client, `!document.querySelector('.tt-gh-modal[role="dialog"]') && !document.body.classList.contains('tt-site-dialog-open') && document.body.dataset.ttMediaPlayback === 'paused'`);
    assert(worksDialogClosed, 'interaction: WORKS Gallery dialog did not close cleanly');
    passed.push('works-dialog');

    await navigateForInteraction(client, `${origin}/members/?lang=kr&runtime-interaction=1`);
    const memberFocused = await evaluate(client, `(() => {
      const trigger = document.querySelector('#c-members .tt-member-card[data-tt-dialog-trigger="true"]');
      trigger?.focus();
      return !!trigger && document.activeElement === trigger;
    })()`);
    assert(memberFocused, 'interaction: MEMBERS keyboard trigger is not focusable');
    await pressKey(client, 'Enter', 'Enter', 13);
    await sleep(220);
    const memberOpen = await evaluate(client, `(() => ({
      dialog: !!document.querySelector('.tt-member-modal[role="dialog"][aria-modal="true"]'),
      closeFocused: document.activeElement?.matches('.tt-member-close') || false,
      focusVisible: document.activeElement?.matches(':focus-visible') || false,
      photoReady: (() => { const image = document.querySelector('.tt-member-modal #m-photo'); return !!(image?.currentSrc && image.complete && image.naturalWidth > 0); })()
    }))()`);
    assert(memberOpen.dialog && memberOpen.closeFocused && memberOpen.focusVisible && memberOpen.photoReady, 'interaction: MEMBERS keyboard dialog or photo is invalid');
    await pressKey(client, 'Escape', 'Escape', 27);
    await sleep(120);
    const memberClosed = await evaluate(client, `!document.querySelector('.tt-member-modal[role="dialog"]') && document.activeElement?.matches('#c-members .tt-member-card[data-tt-dialog-trigger="true"]')`);
    assert(memberClosed, 'interaction: MEMBERS Escape did not close and restore trigger focus');
    passed.push('members-keyboard-dialog');

    await navigateForInteraction(client, `${origin}/news/?lang=kr&runtime-interaction=1`);
    for (const [language, htmlLanguage] of [['en', 'en'], ['jp', 'ja']]) {
      await clickSelector(client, `#lang-${language}`);
      await sleep(180);
      const languageState = await evaluate(client, `(() => ({
        lang: document.documentElement.lang,
        pressed: document.querySelector('#lang-${language}')?.getAttribute('aria-pressed')
      }))()`);
      assert(languageState.lang === htmlLanguage && languageState.pressed === 'true', `interaction: ${language.toUpperCase()} language switch failed`);
    }
    await clickSelector(client, '#c-news .lift[data-tt-dialog-trigger="true"]');
    await sleep(120);
    const newsOpen = await evaluate(client, `!!document.querySelector('.tt-news-modal[role="dialog"][aria-modal="true"]') && document.body.classList.contains('tt-site-dialog-open')`);
    assert(newsOpen, 'interaction: NEWS dialog did not open');
    await clickSelector(client, '.tt-news-modal button[aria-label="Close"]');
    await sleep(120);
    const newsClosed = await evaluate(client, `!document.querySelector('.tt-news-modal[role="dialog"]') && !document.body.classList.contains('tt-site-dialog-open')`);
    assert(newsClosed, 'interaction: NEWS dialog did not close cleanly');
    passed.push('news-language-dialog');

    await navigateForInteraction(client, `${origin}/story-types/?lang=kr&runtime-interaction=1`);
    const beforeSkippedMembers = await evaluate(client, `document.querySelectorAll('#c-members .tt-member-card img[src]').length`);
    await clickSelector(client, '#nav-4');
    await sleep(1_800);
    const chapterTransition = await evaluate(client, `(() => ({
      path: location.pathname,
      chapter: document.body.getAttribute('data-active-chapter'),
      cards: document.querySelectorAll('[data-works-card]').length,
      memberImages: document.querySelectorAll('#c-members .tt-member-card img[src]').length
    }))()`);
    assert(beforeSkippedMembers === 0 && chapterTransition.memberImages === 0, 'interaction: skipped MEMBERS chapter loaded hidden member images');
    assert(chapterTransition.path === '/works/' && chapterTransition.chapter === 'works' && chapterTransition.cards === 21, 'interaction: STORY TYPES to WORKS transition did not settle');
    passed.push('chapter-transition-preload');

    const network = capture.finish();
    assert(network.audioRequests === 1 && new Set(network.audioUrls).size === 1, `interaction: expected one selected MP3 request, found ${network.audioRequests}`);
    assert(network.audioUrls[0]?.endsWith('/assets/works/audio/Fix-Bubblesweet.mp3'), `interaction: unexpected MP3 requested: ${network.audioUrls.join(', ')}`);
    assert(network.sameOriginFailures.length === 0, `interaction: network errors: ${network.sameOriginFailures.join(', ')}`);
    assert(network.runtimeErrors.length === 0, `interaction: runtime errors: ${network.runtimeErrors.join(' | ')}`);
    return passed;
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {});
  }
}

function validateResult(result) {
  const { key, page, cold, warm, idle } = result;
  assert(cold.firstPartyRequestCount <= page.maxFirstPartyRequests, `${key}: cold first-party requests ${cold.firstPartyRequestCount} > ${page.maxFirstPartyRequests}: ${JSON.stringify(cold.byOrigin)}`);
  assert(cold.googleFontRequestCount <= page.maxGoogleFontRequests, `${key}: Google Fonts requests ${cold.googleFontRequestCount} > ${page.maxGoogleFontRequests}: ${JSON.stringify(cold.byOrigin)}`);
  assert(cold.unexpectedThirdPartyUrls.length === 0, `${key}: unexpected third-party requests: ${cold.unexpectedThirdPartyUrls.join(', ')}`);
  assert(cold.transferBytes <= page.maxTransferBytes, `${key}: cold transfer ${cold.transferBytes} > ${page.maxTransferBytes}`);
  assert(cold.cls <= page.maxCls, `${key}: cold CLS ${cold.cls.toFixed(4)} > ${page.maxCls}: ${JSON.stringify(cold.shifts)}`);
  assert(cold.fcp > 0 && cold.fcp <= page.maxFcpMs, `${key}: cold FCP ${cold.fcp.toFixed(1)}ms is outside budget`);
  assert(cold.lcp > 0 && cold.lcp <= page.maxLcpMs, `${key}: cold LCP ${cold.lcp.toFixed(1)}ms is outside budget`);
  assert(cold.longTasks <= page.maxLongTasks, `${key}: cold long tasks ${cold.longTasks} > ${page.maxLongTasks}`);
  assert(cold.domNodes <= page.maxDomNodes, `${key}: DOM nodes ${cold.domNodes} > ${page.maxDomNodes}`);
  assert(!cold.overflow && !warm.overflow, `${key}: horizontal overflow detected`);
  assert(cold.sameOriginFailures.length === 0 && warm.sameOriginFailures.length === 0, `${key}: same-origin network errors: ${[...cold.sameOriginFailures, ...warm.sameOriginFailures].join(', ')}`);
  assert(cold.runtimeErrors.length === 0 && warm.runtimeErrors.length === 0, `${key}: runtime errors: ${[...cold.runtimeErrors, ...warm.runtimeErrors].join(' | ')}`);
  assert(cold.observerErrors.length === 0 && warm.observerErrors.length === 0, `${key}: window errors: ${[...cold.observerErrors, ...warm.observerErrors].join(' | ')}`);
  assert(cold.audioRequests === 0 && warm.audioRequests === 0, `${key}: MP3 requested before user playback`);
  assert(cold.memberImagesAssigned === 0 && warm.memberImagesAssigned === 0, `${key}: hidden member images were assigned outside MEMBERS`);
  assert(warm.transferBytes <= 100_000, `${key}: warm transfer ${warm.transferBytes} > 100000: ${JSON.stringify(warm.uncachedRequests.slice(0, 8))}`);
  if (page.key === 'home') {
    assert(cold.worksDataRequests === 0 && warm.worksDataRequests === 0, `${key}: HOME requested works-data.json`);
    assert(cold.chapter === 'home' && warm.chapter === 'home', `${key}: intro did not settle on HOME`);
    assert(cold.homeTop != null && warm.homeTop != null && Math.abs(cold.homeTop) <= 2 && Math.abs(warm.homeTop) <= 2, `${key}: HOME did not settle at the section origin`);
    assert(cold.contentScrollTop != null && warm.contentScrollTop != null && cold.contentScrollTop <= 2 && warm.contentScrollTop <= 2, `${key}: HOME intro changed the scroll position`);
  } else {
    assert(cold.worksDataRequests === 1, `${key}: WORKS cold data requests ${cold.worksDataRequests} != 1`);
    assert(warm.worksDataRequests <= 1, `${key}: WORKS warm data requested more than once`);
    assert(cold.worksCards === 21 && warm.worksCards === 21, `${key}: expected 21 WORKS cards`);
  }
  if (idle) {
    assert(idle.taskDuration <= 0.90, `${key}: idle TaskDuration ${idle.taskDuration.toFixed(3)}s / 3s > 0.90s`);
    assert(idle.recalcStyleCount <= 60, `${key}: idle style recalculations ${idle.recalcStyleCount} / 3s > 60`);
  }
}

let serverHandle;
let chrome;
try {
  serverHandle = await startStaticServer();
  chrome = await launchChrome(await findChrome());
  const results = [];
  for (const viewport of viewports) {
    for (const page of pages) {
      const result = await runCase(chrome, serverHandle.origin, page, viewport);
      validateResult(result);
      results.push(result);
    }
  }
  const functionalChecks = await runFunctionalMatrix(chrome, serverHandle.origin);
  const interactionChecks = await runInteractionSmoke(chrome, serverHandle.origin);

  console.table(results.map(({ key, cold, warm, idle }) => ({
    case: key,
    requests: cold.requestCount,
    firstParty: cold.firstPartyRequestCount,
    googleFonts: cold.googleFontRequestCount,
    coldKB: Math.round(cold.transferBytes / 1024),
    warmKB: Math.round(warm.transferBytes / 1024),
    FCPms: Math.round(cold.fcp),
    LCPms: Math.round(cold.lcp),
    CLS: Number(cold.cls.toFixed(4)),
    longTasks: cold.longTasks,
    DOM: cold.domNodes,
    idleTaskMs: idle ? Math.round(idle.taskDuration * 1000) : '',
    idleRecalc: idle ? idle.recalcStyleCount : '',
  })));
  if (errors.length) {
    console.error(`Runtime performance validation failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Runtime performance validation passed: ${results.length} cold/warm performance cases, ${functionalChecks.length} route/language/viewport checks, and ${interactionChecks.length} interaction checks.`);
  }
} finally {
  if (chrome) await chrome.close();
  if (serverHandle) await new Promise((resolve) => serverHandle.server.close(resolve));
}
