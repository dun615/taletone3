import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) errors.push(message); };
const isGoogleFontRequest = (url) => /^https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/|$)/i.test(url);
// DISCOGRAPHY's video rows show YouTube's own thumbnails (lazy; no player until a click)
const isVideoThumbRequest = (url) => /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/hqdefault\.jpg$/i.test(url);

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
    // Runs #54-#56 measured 16 first-party requests and 20-23 Google Fonts requests on Linux; phones add one
    // for the newest work's cover on the home page.
    maxFirstPartyRequests: 19, maxGoogleFontRequests: 30,
    maxTransferBytes: 1_200_000, maxWarmFirstPartyTransferBytes: 20_000, maxCls: 0.08,
    maxFcpMs: 2_000, maxLcpMs: 6_000, maxLongTasks: 45, maxDomNodes: 1_500,
  },
  {
    key: 'works', path: '/works/', coldWaitMs: 3_500, warmWaitMs: 2_000,
    // Desktop: the sea of records loads its first discs' covers at once and the rest as they near the screen
    // (measured 39 locally). Phones: the stage and the record bin (first four sleeves eager), measured 33.
    maxFirstPartyRequests: 50, maxGoogleFontRequests: 30,
    maxTransferBytes: 2_800_000, maxWarmFirstPartyTransferBytes: 20_000, maxCls: 0.08,
    maxFcpMs: 2_000, maxLcpMs: 3_000, maxLongTasks: 12, maxDomNodes: 2_000,
  },
];

const functionalRoutes = [
  { key: 'home', path: '/', chapter: 'home', section: '#c-home' },
  { key: 'story-types', path: '/story-types/', chapter: 'projects', section: '#c-projects' },
  { key: 'members', path: '/members/', chapter: 'members', section: '#c-members' },
  { key: 'works', path: '/works/', chapter: 'works', section: '#c-works' },
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
    '--headless=new', '--mute-audio', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
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
      const firstPartyTransferBytes = list.reduce((sum, request) => sum + (!request.fromCache && request.url.startsWith(origin) ? request.bytes : 0), 0);
      const googleFontTransferBytes = list.reduce((sum, request) => sum + (!request.fromCache && isGoogleFontRequest(request.url) ? request.bytes : 0), 0);
      const firstPartyUncachedRequests = uncachedRequests.filter((request) => request.url.startsWith(origin));
      const unexpectedThirdPartyUrls = [...new Set(list
        .filter((request) => !request.url.startsWith(origin) && !isGoogleFontRequest(request.url) && !isVideoThumbRequest(request.url))
        .map((request) => request.url))];
      return {
        requestCount: list.length,
        firstPartyRequestCount,
        googleFontRequestCount,
        firstPartyTransferBytes,
        googleFontTransferBytes,
        firstPartyUncachedRequests,
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
      worksCards: document.querySelectorAll('[data-works-book]').length,
      memberImagesAssigned: document.querySelectorAll('#c-members .tt-crew-row img[src]').length,
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
              worksCards: document.querySelectorAll('[data-works-book]').length,
              memberImagesAssigned: document.querySelectorAll('#c-members .tt-crew-row img[src]').length,
              memberImagesDeferred: document.querySelectorAll('#c-members .tt-crew-row img[data-member-src]').length,
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
          if (route.key === 'works') {
            assert(state.worksCards >= 6, `${key}: expected the first WORKS shelf, found ${state.worksCards} books`);
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
      books: document.querySelectorAll('[data-works-book]').length,
      play: !!document.querySelector('[data-works-book="0"] .tt-float-pick') && !!document.querySelector('.tt-console-host'),
      playback: document.body.dataset.ttMediaPlayback || 'paused'
    }))()`);
    assert(worksReady.chapter === 'works' && worksReady.books >= 6 && worksReady.play, `interaction: WORKS record shop did not initialize: ${JSON.stringify(worksReady)}`);
    assert(worksReady.playback !== 'playing', 'interaction: WORKS audio started without user playback');

    // desktop: the records float in the sea; picking one plays it and the console follows
    await clickSelector(client, '[data-works-book="0"] .tt-float-pick');
    await sleep(1_000);
    const playing = await evaluate(client, `(() => ({
      playback: document.body.dataset.ttMediaPlayback,
      button: document.querySelector('[data-works-book="0"]')?.classList.contains('is-playing'),
      player: !!document.querySelector('.tt-console.is-playing .tt-deck-toggle.is-playing')
    }))()`);
    assert(playing.playback === 'playing', `interaction: WORKS playback state is ${playing.playback || 'missing'}`);
    assert(playing.button && playing.player, 'interaction: playing disc or console did not show its state');
    passed.push('works-play');

    await clickSelector(client, '.tt-console-more');
    await sleep(200);
    const popup = await evaluate(client, `({open:!!document.querySelector('.tt-shelf-modal[role="dialog"][aria-modal="true"]'),dialog:document.body.classList.contains('tt-site-dialog-open'),playback:document.body.dataset.ttMediaPlayback,permalink:!!document.querySelector('.tt-shelf-modal a[href*="/works/"]')})`);
    assert(popup.permalink, 'interaction: WORKS popup has no permalink to the work page');
    assert(popup.open && popup.dialog && popup.playback === 'playing', `interaction: WORKS popup did not open over playing music: ${JSON.stringify(popup)}`);
    await clickSelector(client, '.tt-shelf-modal-close');
    await sleep(200);
    const closedPopup = await evaluate(client, `({open:!!document.querySelector('.tt-shelf-modal'),dialog:document.body.classList.contains('tt-site-dialog-open')})`);
    assert(!closedPopup.open && !closedPopup.dialog, 'interaction: WORKS popup did not close cleanly');
    passed.push('works-popup');

    await clickSelector(client, '.tt-deck-toggle');
    await sleep(120);
    assert(await evaluate(client, `document.body.dataset.ttMediaPlayback === 'paused'`), 'interaction: console play button did not pause');
    passed.push('works-pause');

    // the field lamps light the matching songs (singles and album tracks) and their albums; the rest sink
    const rackState = `(() => ({ songs: document.querySelectorAll('.tt-float:not(.is-album):not(.is-dark)').length, plates: document.querySelectorAll('.tt-float.is-album:not(.is-dark)').length }))()`;
    await clickSelector(client, '[data-works-action="filter"][data-filter="game"]');
    await sleep(700);
    const games = await evaluate(client, rackState);
    assert(games.songs === 16 && games.plates === 3, `interaction: game lamp expected 16 songs and 3 albums lit, found ${JSON.stringify(games)}`);
    // the service tabs: mixing & mastering is a video grid shown twelve at a time
    await clickSelector(client, '[data-works-action="tab"][data-tab="mix"]');
    await sleep(500);
    const mixTab = await evaluate(client, `({ cards: document.querySelectorAll('.tt-mix-grid .tt-mix-card').length, more: !!document.querySelector('.tt-mix-more'), rack: document.querySelectorAll('.tt-float').length })`);
    assert(mixTab.cards === 12 && mixTab.more && mixTab.rack === 0, `interaction: mixing tab expected 12 video cards and a more button, found ${JSON.stringify(mixTab)}`);
    await clickSelector(client, '[data-works-action="tab"][data-tab="songs"]');
    await sleep(500);
    await clickSelector(client, '[data-works-action="filter"][data-filter="all"]');
    await sleep(700);
    const all = await evaluate(client, rackState);
    assert(all.songs === 60 && all.plates === 6, `interaction: whole sea expected 60 songs and 6 albums lit, found ${JSON.stringify(all)}`);
    passed.push('works-filter-shelf');

    // leaving the WORKS chapter stops the music
    await clickSelector(client, '.tt-deck-toggle');
    await sleep(800);
    assert(await evaluate(client, `document.body.dataset.ttMediaPlayback === 'playing'`), 'interaction: console play button did not resume');
    await clickSelector(client, '#nav-6');
    let leftWorks = false;
    for (let n = 0; n < 40 && !leftWorks; n++) { await sleep(100); leftWorks = await evaluate(client, `document.body.getAttribute('data-active-chapter') === 'contact'`); }
    assert(leftWorks, 'interaction: chapter menu did not move from WORKS to CONTACT');
    assert(await evaluate(client, `document.body.dataset.ttMediaPlayback !== 'playing'`), 'interaction: WORKS music kept playing after leaving the chapter');
    passed.push('works-leave-pause');

    await navigateForInteraction(client, `${origin}/works/?lang=kr&runtime-interaction=1`);
    for (let n = 0; n < 40; n++) { if (await evaluate(client, `!!document.querySelector('.tt-shelf-history')`)) break; await sleep(100); }
    await clickSelector(client, '.tt-shelf-history');
    await sleep(400);
    const historyOpen = await evaluate(client, `(() => ({
      dialog: !!document.querySelector('.tt-member-modal[role="dialog"][aria-modal="true"]'),
      credits: (document.querySelector('.tt-sheet-credits')?.innerText || '').length
    }))()`);
    assert(historyOpen.dialog && historyOpen.credits > 200, 'interaction: DISCOGRAPHY history button did not open the profile sheet');
    await pressKey(client, 'Escape', 'Escape', 27);
    await sleep(200);
    assert(await evaluate(client, `!document.querySelector('.tt-member-modal[role="dialog"]')`), 'interaction: profile sheet did not close on Escape');
    passed.push('history-dialog');

    await navigateForInteraction(client, `${origin}/contact/?lang=kr&runtime-interaction=1`);
    for (const [language, htmlLanguage] of [['en', 'en'], ['jp', 'ja']]) {
      await clickSelector(client, `#lang-${language}`);
      await sleep(180);
      const languageState = await evaluate(client, `(() => ({
        lang: document.documentElement.lang,
        pressed: document.querySelector('#lang-${language}')?.getAttribute('aria-pressed')
      }))()`);
      assert(languageState.lang === htmlLanguage && languageState.pressed === 'true', `interaction: ${language.toUpperCase()} language switch failed`);
    }
    passed.push('language-switch');

    await navigateForInteraction(client, `${origin}/story-types/?lang=kr&runtime-interaction=1`);
    await clickSelector(client, '#nav-4');
    await sleep(1_800);
    const chapterTransition = await evaluate(client, `(() => ({
      path: location.pathname,
      chapter: document.body.getAttribute('data-active-chapter'),
      cards: document.querySelectorAll('[data-works-book]').length
    }))()`);
    assert(chapterTransition.path === '/works/' && chapterTransition.chapter === 'works' && chapterTransition.cards >= 6, 'interaction: STORY TYPES to WORKS transition did not settle');
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

async function runBridgeSmoke(chrome, origin) {
  const passed = [];
  const destinations = ['c-members','c-projects','c-works','c-contact'];
  const paths = ['/members/','/story-types/','/works/','/contact/'];
  const bridgeViewports=[...functionalViewports,
    {key:'small-phone-reduced',width:320,height:568,mobile:true,reduced:true},
    {key:'phone-landscape',width:844,height:390,mobile:true}];
  for (const [caseIndex, viewport] of bridgeViewports.entries()) {
    if(process.env.BRIDGE_VIEWPORT && viewport.key!==process.env.BRIDGE_VIEWPORT) continue;
    const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    try {
      await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
      await client.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile });
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      await client.send('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:viewport.reduced?'reduce':'no-preference'}] });
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: "sessionStorage.setItem('tt_intro_home_v5','1');" });
      const capture = capturePhase(client, origin);
      // Legacy ?lang= links land on the language's own URL prefix.
      const langPrefix=['','/en','/ja'][caseIndex%3];
      await navigateForInteraction(client, `${origin}/?lang=${['kr','en','jp'][caseIndex%3]}&bridge-check=1`, 2000);
      for (let index=0; index<4; index++) {
        const label = `bridge/${viewport.key}/${index+1}`;
        // WORKS mounts on demand after chapter entry. Do not aim at its stale placeholder boundary.
        if(index===3){
          for(let n=0;n<40;n++){
            if(await evaluate(client, `document.querySelectorAll('[data-works-book]').length>=6`)) break;
            await sleep(100);
          }
          await sleep(300);
        }
        await evaluate(client, `(() => {
          const sc=document.getElementById('content'), outer=document.querySelectorAll('[data-story-bridge-wrap]')[${index}];
          window.__bridgeFrames=[]; const token=window.__bridgeWatchToken=(window.__bridgeWatchToken||0)+1;
          window.__bridgeHistoryLength=history.length;
          window.__bridgeEntryRequestedAt=performance.now();
          const record=()=>{
            if(window.__bridgeWatchToken!==token) return;
            const r=(outer.querySelector('.tt-bridge-pin-stage')||outer).getBoundingClientRect();
            if(!window.__bridgeResizing) window.__bridgeFrames.push({time:performance.now(),phase:sc.dataset.bridgeIndex==='${index}'?(sc.dataset.bridgePhase||''):'',top:r.top,scroll:sc.scrollTop,anchor:outer.offsetTop});
            requestAnimationFrame(record);
          }; requestAnimationFrame(record);
          if(sc.dataset.bridgeIndex!=='${index}') sc.scrollTo({top:outer.offsetTop-sc.clientHeight*0.35,behavior:'instant'});
        })()`);
        let locked=false;
        for(let n=0;n<30;n++){
          locked=await evaluate(client, `document.getElementById('content').dataset.bridgeIndex==='${index}'`);
          if(locked) break;
          await sleep(50);
        }
        assert(locked, `${label}: entry did not lock`);
        const preloading = await evaluate(client, `!!document.querySelector('#${destinations[index]}[data-chapter-preloaded]')`);
        assert(preloading, `${label}: next chapter preload did not start at bridge entry`);
        const lock = await evaluate(client, `(() => {const s=document.getElementById('content');return {overflow:getComputedStyle(s).overflowY,touch:getComputedStyle(s).touchAction,snap:getComputedStyle(s).scrollSnapType,cue:!!document.querySelector('.tt-bridge-continue')};})()`);
        assert(lock.overflow==='hidden' && lock.touch==='none' && lock.snap==='none' && !lock.cue, `${label}: conflicting native scroll/cue still enabled: ${JSON.stringify(lock)}`);
        // Real browser input, including reverse direction, during playback AND reading hold.
        for(let n=0;n<45;n++){
          const phase=await evaluate(client, `(() => {const s=document.getElementById('content');return s.dataset.bridgeIndex==='${index}'?(s.dataset.bridgePhase||''):'';})()`);
          if(!phase || phase==='advancing') break;
          await client.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:viewport.width/2,y:viewport.height/2,deltaX:0,deltaY:n%2?900:-900});
          const keys=[['PageDown','PageDown',34],['ArrowUp','ArrowUp',38],[' ','Space',32],['Home','Home',36],['End','End',35]];
          const key=keys[n%keys.length];
          await pressKey(client,...key);
          if(viewport.key==='tablet' && index===1 && n===4){
            await evaluate(client, 'window.__bridgeResizing=true');
            await client.send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:true});
            await sleep(200);
            const resized=await evaluate(client, `(() => {const s=document.getElementById('content');return {phase:s.dataset.bridgePhase,top:document.querySelectorAll('[data-story-bridge-wrap]')[1].getBoundingClientRect().top};})()`);
            assert(!!resized.phase && Math.abs(resized.top)<=1, 'bridge/tablet: rotation lost the locked anchor');
            await evaluate(client, 'window.__bridgeResizing=false');
          }
          if(n===2||n===12){
            await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:viewport.width/2,y:viewport.height*0.7}]});
            await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:viewport.width/2,y:viewport.height*0.3}]});
            await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          }
          if(n===6){
            // Momentum (touch flick, trackpad inertia, in-flight smooth wheel scroll) moves the scroller with no input event.
            await evaluate(client, `document.getElementById('content').scrollTop += 420`);
          }
          if(index===3 && n===5){
            // Simulate a late resource changing the height of an earlier chapter.
            await evaluate(client, `(() => {const spacer=document.createElement('div');spacer.id='bridge-test-late-layout';spacer.style.height='160px';document.getElementById('c-home').after(spacer);})()`);
          }
          if(index===0&&n===10 && process.env.BRIDGE_SCREENSHOTS){
            await mkdir(process.env.BRIDGE_SCREENSHOTS,{recursive:true});
            const shot=await client.send('Page.captureScreenshot',{format:'png'});
            await writeFile(path.join(process.env.BRIDGE_SCREENSHOTS,`${viewport.key}-bridge.png`),Buffer.from(shot.data,'base64'));
          }
          await sleep(100);
          if(n===10 && index===2){
            const ready = await evaluate(client, `(() => {
              const section=document.getElementById('${destinations[index]}');
              const images=Array.from(section.querySelectorAll('.tt-float img[src], .tt-crate-item img[src], .tt-rack-item img[src]'));
              return images.length>0 && images.every(img=>img && img.complete && img.naturalWidth>0);
            })()`);
            assert(ready, `${label}: next chapter images were not ready during playback`);
          }
        }
        for(let n=0;n<35;n++){
          if(!await evaluate(client, `document.getElementById('content').dataset.bridgeIndex==='${index}'`)) break;
          await sleep(100);
        }
        const result=await evaluate(client, `(() => {
          window.__bridgeWatchToken++;
          const s=document.getElementById('content'), frames=window.__bridgeFrames;
          const fixed=frames.filter(f=>f.phase==='playing'||f.phase==='holding');
          const advancing=frames.find(f=>f.phase==='advancing');
          return {phase:s.dataset.bridgeIndex==='${index}'?(s.dataset.bridgePhase||''):'',overflow:getComputedStyle(s).overflowY,path:location.pathname,
            top:document.getElementById('${destinations[index]}').getBoundingClientRect().top,
            drift:fixed.length?Math.max(...fixed.map(f=>Math.abs(f.top))):999,
            anchorDrift:fixed.length?Math.max(...fixed.map(f=>Math.abs(f.scroll-f.anchor))):999,
            duration:fixed.length?(advancing?.time||fixed.at(-1).time)-window.__bridgeEntryRequestedAt:0,historyDelta:history.length-window.__bridgeHistoryLength,
            holding:fixed.some(f=>f.phase==='holding'),frames:fixed.length};
        })()`);
        // The test scrolls throughout: the animation must still play in full, then the hold shortens to a quick handoff.
        assert(result.drift<=1, `${label}: locked viewport drift ${result.drift}px`);
        assert(result.anchorDrift<=1.5, `${label}: locked scroll left its anchor by ${result.anchorDrift}px (momentum/late layout not re-pinned)`);
        assert(result.holding && result.duration>=(viewport.reduced?1000:1150) && result.duration<=3600, `${label}: configured playback/reading hold not preserved: ${JSON.stringify(result)}`);
        assert(result.historyDelta===1, `${label}: handoff must navigate exactly once`);
        assert(!result.phase && result.overflow==='auto' && result.path===langPrefix+paths[index] && Math.abs(result.top)<=2, `${label}: automatic handoff/release failed: ${JSON.stringify(result)}`);
        console.log(label, JSON.stringify(result));
        passed.push(label);
        if(index===3) await evaluate(client, `document.getElementById('bridge-test-late-layout')?.remove()`);
      }
      // Completed bridges stay final and scroll freely, including after chapter/language changes.
      await evaluate(client, `document.getElementById('nav-0').click()`);
      await sleep(1800);
      for(let index=0;index<4;index++){
        const selector=`document.querySelectorAll('[data-story-bridge-wrap]')[${index}]`;
        await evaluate(client, `(() => {const s=document.getElementById('content'),b=${selector};s.scrollTo({top:b.offsetTop,behavior:'instant'});})()`);
        await sleep(400);
        const before=await evaluate(client, `(() => {
          const s=document.getElementById('content'),b=${selector};
          window.__finalBridgeSnapshot=()=>Array.from(b.querySelectorAll('[data-bridge] span,.tt-bridge-visual *')).map(el=>[el.style.height,el.style.opacity,el.style.transform].join('|')).join(';');
          return {phase:s.dataset.bridgePhase||'',frame:window.__finalBridgeSnapshot(),top:s.scrollTop,history:history.length};
        })()`);
        await sleep(250);
        const after=await evaluate(client,`({phase:document.getElementById('content').dataset.bridgePhase||'',frame:window.__finalBridgeSnapshot(),history:history.length})`);
        assert(!before.phase&&!after.phase&&before.frame===after.frame&&before.history===after.history,`bridge/${viewport.key}/revisit/${index}: completed frame restarted or moved`);
        await client.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:viewport.width/2,y:viewport.height/2,deltaX:0,deltaY:140});
        await sleep(180);
        const free=await evaluate(client,`({top:document.getElementById('content').scrollTop,phase:document.getElementById('content').dataset.bridgePhase||''})`);
        assert(!free.phase&&free.top>before.top+20,`bridge/${viewport.key}/revisit/${index}: ordinary scrolling was blocked`);
        passed.push(`bridge/${viewport.key}/revisit/${index}`);
      }
      await evaluate(client, `window.postMessage({type:'TALETONE_SET_LANG',lang:'jp'},'*')`);
      await sleep(400);
      await navigateForInteraction(client, `${origin}/?lang=jp&bridge-reload=1`,1500);
      await evaluate(client, `document.getElementById('content').scrollTo({top:document.querySelector('[data-story-bridge-wrap]').offsetTop,behavior:'instant'})`);
      await sleep(500);
      const restored=await evaluate(client, `({seen:JSON.parse(sessionStorage.getItem('tt_bridge_seen_v2')||'[]'),phase:document.getElementById('content').dataset.bridgePhase||''})`);
      assert(restored.seen.length===4&&!restored.phase,`bridge/${viewport.key}: reload forgot bridge completion`);
      passed.push(`bridge/${viewport.key}/session-reload`);
      // A skipped/cancelled animation must not be recorded as watched.
      await evaluate(client, `sessionStorage.removeItem('tt_bridge_seen_v2')`);
      await navigateForInteraction(client, `${origin}/?bridge-cancel=1`,1300);
      await evaluate(client, `document.getElementById('content').scrollTo({top:document.querySelector('[data-story-bridge-wrap]').offsetTop,behavior:'instant'})`);
      await sleep(400);
      assert(await evaluate(client, `document.getElementById('content').dataset.bridgeIndex==='0'`),`bridge/${viewport.key}: fresh prologue bridge did not lock`);
      await evaluate(client, `document.getElementById('nav-6').click()`);
      await sleep(1800);
      const canceled=await evaluate(client,`({path:location.pathname,phase:document.getElementById('content').dataset.bridgePhase||'',seen:JSON.parse(sessionStorage.getItem('tt_bridge_seen_v2')||'[]')})`);
      // The unprefixed URL restores the JP choice saved above.
      assert(canceled.path==='/ja/contact/'&&!canceled.phase&&canceled.seen.length===0,`bridge/${viewport.key}: navigation falsely completed an unwatched animation`);
      passed.push(`bridge/${viewport.key}/navigation-cancel`);
      const network=capture.finish();
      assert(network.audioRequests===0, `bridge/${viewport.key}: audio loaded without playback`);
      assert(network.runtimeErrors.length===0, `bridge/${viewport.key}: ${network.runtimeErrors.join(' | ')}`);
    } finally {
      client.close();
      await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(()=>{});
    }
  }
  passed.push(...await runFirstBridgeOnPhone(chrome, origin));
  return passed;
}

// A first visit on a short phone screen (a Z Fold cover is about 412x660): reading straight down must lock the
// first bridge, right after the intro. The intro's settling glide upward was once taken as the reader going up
// (phones skip the direction-tracking frames while scrolling fast) and the first flick passed the bridge.
async function runFirstBridgeOnPhone(chrome, origin) {
  const passed = [];
  const cases = [
    { key: 'after-intro-2.8s', wait: 2800 },
    { key: 'after-intro-5.4s', wait: 5400 }
  ];
  for (const testCase of cases) {
    const label = `bridge/phone-first-visit/${testCase.key}`;
    const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    try {
      await Promise.all([client.send('Page.enable'), client.send('Runtime.enable')]);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 660, deviceScaleFactor: 1, mobile: true });
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await navigateForInteraction(client, `${origin}/?first-bridge=${testCase.key}`, testCase.wait);
      await evaluate(client, `(() => { window.__firstBridge = false; const sc = document.getElementById('content');
        const watch = () => { if (sc.dataset.bridgeIndex === '0') window.__firstBridge = true; if (!window.__firstBridge) requestAnimationFrame(watch); };
        watch(); return true; })()`);
      // three touch flicks with momentum, as a reader does right after the page opens
      for (let i = 0; i < 3 && !(await evaluate(client, 'window.__firstBridge')); i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 475 }] });
        for (let k = 1; k <= 5; k++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 475 - k * 60 }] }); await sleep(12); }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(700);
      }
      await sleep(400);
      assert(await evaluate(client, 'window.__firstBridge'), `${label}: the first bridge did not lock while reading straight down`);
      passed.push(label);
    } finally {
      client.close();
      await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(()=>{});
    }
  }
  return passed;
}

function validateResult(result) {
  const { key, page, cold, warm, idle } = result;
  assert(cold.firstPartyRequestCount <= page.maxFirstPartyRequests, `${key}: cold first-party requests ${cold.firstPartyRequestCount} > ${page.maxFirstPartyRequests}: ${JSON.stringify(cold.byOrigin)}`);
  assert(cold.googleFontRequestCount <= page.maxGoogleFontRequests, `${key}: Google Fonts requests ${cold.googleFontRequestCount} > ${page.maxGoogleFontRequests}: ${JSON.stringify(cold.byOrigin)}`);
  assert(cold.unexpectedThirdPartyUrls.length === 0 && warm.unexpectedThirdPartyUrls.length === 0, `${key}: unexpected third-party requests: ${[...cold.unexpectedThirdPartyUrls, ...warm.unexpectedThirdPartyUrls].join(', ')}`);
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
  assert(warm.firstPartyTransferBytes <= page.maxWarmFirstPartyTransferBytes, `${key}: warm first-party transfer ${warm.firstPartyTransferBytes} > ${page.maxWarmFirstPartyTransferBytes}: ${JSON.stringify(warm.firstPartyUncachedRequests.slice(0, 8))}`);
  if (page.key === 'home') {
    assert(cold.worksDataRequests === 0 && warm.worksDataRequests === 0, `${key}: HOME requested works-data.json`);
    assert(cold.chapter === 'home' && warm.chapter === 'home', `${key}: intro did not settle on HOME`);
    assert(cold.homeTop != null && warm.homeTop != null && Math.abs(cold.homeTop) <= 2 && Math.abs(warm.homeTop) <= 2, `${key}: HOME did not settle at the section origin`);
    assert(cold.contentScrollTop != null && warm.contentScrollTop != null && cold.contentScrollTop <= 2 && warm.contentScrollTop <= 2, `${key}: HOME intro changed the scroll position`);
  } else {
    assert(cold.worksDataRequests === 1, `${key}: WORKS cold data requests ${cold.worksDataRequests} != 1`);
    assert(warm.worksDataRequests <= 1, `${key}: WORKS warm data requested more than once`);
    assert(cold.worksCards >= 6 && warm.worksCards >= 6, `${key}: expected the first WORKS shelf`);
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
  for (const viewport of process.env.BRIDGE_ONLY ? [] : viewports) {
    for (const page of pages) {
      const result = await runCase(chrome, serverHandle.origin, page, viewport);
      validateResult(result);
      results.push(result);
    }
  }
  const functionalChecks = process.env.BRIDGE_ONLY ? [] : await runFunctionalMatrix(chrome, serverHandle.origin);
  const interactionChecks = process.env.BRIDGE_ONLY ? [] : await runInteractionSmoke(chrome, serverHandle.origin);
  const bridgeChecks = process.env.SKIP_BRIDGES ? [] : await runBridgeSmoke(chrome, serverHandle.origin);

  console.table(results.map(({ key, cold, warm, idle }) => ({
    case: key,
    requests: cold.requestCount,
    firstParty: cold.firstPartyRequestCount,
    googleFonts: cold.googleFontRequestCount,
    coldKB: Math.round(cold.transferBytes / 1024),
    warmKB: Math.round(warm.transferBytes / 1024),
    warmFirstPartyKB: Math.round(warm.firstPartyTransferBytes / 1024),
    warmGoogleFontsKB: Math.round(warm.googleFontTransferBytes / 1024),
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
    // on GitHub Actions each failure also becomes an annotation, readable from the public checks API
    if (process.env.GITHUB_ACTIONS) for (const error of errors) console.log(`::error title=Runtime check::${String(error).replace(/\r?\n/g, ' ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Runtime performance validation passed: ${results.length} cold/warm performance cases, ${functionalChecks.length} route/language/viewport checks, ${interactionChecks.length} interaction checks, and ${bridgeChecks.length} bridge checks.`);
  }
} finally {
  if (chrome) await chrome.close();
  if (serverHandle) await new Promise((resolve) => serverHandle.server.close(resolve));
}
