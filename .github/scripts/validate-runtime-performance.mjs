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
// the record's album tracks and video rows show YouTube's own thumbnails (lazy; no player until a click)
const isVideoThumbRequest = (url) => /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/(?:mq|hq)default\.jpg$/i.test(url);

const viewports = [
  { key: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { key: 'mobile', width: 390, height: 844, dpr: 3, mobile: true },
];
const functionalViewports = [
  viewports[0],
  { key: 'tablet', width: 820, height: 1180, dpr: 2, mobile: true },
  viewports[1],
];

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

// A cold runner can take a while to start Chrome: wait up to 30 s, and start it again up to three times.
async function launchChrome(chromePath) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await launchChromeOnce(chromePath); }
    catch (error) { last = error; console.warn(`Chrome start ${attempt}/3 failed: ${error.message}`); }
  }
  throw last;
}

async function launchChromeOnce(chromePath) {
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
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Chrome exited early (${child.exitCode}): ${stderr}`);
    try {
      const contents = await readFile(portFile, 'utf8');
      port = Number(contents.split(/\r?\n/)[0]);
      if (port) break;
    } catch { /* Chrome has not written the port yet. */ }
    await sleep(50);
  }
  if (!port) { child.kill('SIGKILL'); throw new Error(`Chrome debugging port did not become ready: ${stderr}`); }
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
        videoRequests: list.filter((request) => /lockscreen\.mp4(?:[?#]|$)/.test(request.url)).length,
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
    return {
      domContentLoaded: nav.domContentLoadedEventEnd || 0,
      fcp: paints['first-contentful-paint'] || 0,
      lcp: perf.lcp || 0,
      cls: perf.cls || 0,
      shifts: perf.shifts || [],
      longTasks: perf.longTasks || 0,
      longTaskDuration: perf.longTaskDuration || 0,
      domNodes: document.getElementsByTagName('*').length,
      stage: document.documentElement.classList.contains('jy-stage-mode'),
      chapter: (document.querySelector('.jy-rail a[aria-current]') || {}).dataset?.go || '',
      records: document.querySelectorAll('#jy-spiral li').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
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

// ---- the journey: budgets, routes and the checks run against them ----
const pages = [
  // the first chapter: the phone; the lock screen's film loads after the page (4 MB, counted in the cold transfer)
  { key: 'home', path: '/', coldWaitMs: 6_000, warmWaitMs: 2_500, maxFirstPartyRequests: 60, maxGoogleFontRequests: 4, maxTransferBytes: 7_000_000, maxWarmFirstPartyTransferBytes: 60_000, maxCls: 0.05, maxFcpMs: 2_500, maxLcpMs: 4_500, maxLongTasks: 40, maxDomNodes: 3_000, video: true },
  // straight into the record: the film is never loaded
  { key: 'discography', path: '/discography/', coldWaitMs: 4_000, warmWaitMs: 2_000, maxFirstPartyRequests: 70, maxGoogleFontRequests: 4, maxTransferBytes: 4_000_000, maxWarmFirstPartyTransferBytes: 60_000, maxCls: 0.05, maxFcpMs: 2_500, maxLcpMs: 4_500, maxLongTasks: 40, maxDomNodes: 3_000, video: false },
];
const routes = [['pro', '/'], ['tone', '/approach/'], ['tale', '/about/'], ['record', '/discography/'], ['epi', '/contact/']];
const languages = [['kr', '', 'ko'], ['en', '/en', 'en'], ['jp', '/ja', 'ja']];

async function openTab(chrome, viewport) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
  await client.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr, mobile: viewport.mobile });
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: observerScript });
  return { client, close: async () => { client.close(); await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {}); } };
}
async function go(client, url, waitMs) {
  const loaded = client.waitFor('Page.loadEventFired');
  const navigation = await client.send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
  await loaded; await sleep(waitMs);
}

function validateResult(result) {
  const { key, page, cold, warm, idle } = result;
  assert(cold.firstPartyRequestCount <= page.maxFirstPartyRequests, `${key}: cold first-party requests ${cold.firstPartyRequestCount} > ${page.maxFirstPartyRequests}`);
  assert(cold.googleFontRequestCount <= page.maxGoogleFontRequests, `${key}: Google Fonts requests ${cold.googleFontRequestCount} > ${page.maxGoogleFontRequests}`);
  assert(cold.unexpectedThirdPartyUrls.length === 0 && warm.unexpectedThirdPartyUrls.length === 0, `${key}: unexpected third-party requests: ${[...cold.unexpectedThirdPartyUrls, ...warm.unexpectedThirdPartyUrls].join(', ')}`);
  assert(cold.transferBytes <= page.maxTransferBytes, `${key}: cold transfer ${cold.transferBytes} > ${page.maxTransferBytes}`);
  assert(cold.cls <= page.maxCls, `${key}: cold CLS ${cold.cls.toFixed(4)} > ${page.maxCls}: ${JSON.stringify(cold.shifts)}`);
  assert(cold.fcp > 0 && cold.fcp <= page.maxFcpMs, `${key}: cold FCP ${cold.fcp.toFixed(1)}ms is outside budget`);
  assert(cold.lcp <= page.maxLcpMs, `${key}: cold LCP ${cold.lcp.toFixed(1)}ms is outside budget`);
  assert(cold.longTasks <= page.maxLongTasks, `${key}: cold long tasks ${cold.longTasks} > ${page.maxLongTasks}`);
  assert(cold.domNodes <= page.maxDomNodes, `${key}: DOM nodes ${cold.domNodes} > ${page.maxDomNodes}`);
  assert(cold.stage && warm.stage, `${key}: the journey's stage did not start`);
  assert(cold.records >= 30, `${key}: the record lists ${cold.records} works`);
  assert(!cold.overflow && !warm.overflow, `${key}: horizontal overflow detected`);
  assert(cold.sameOriginFailures.length === 0 && warm.sameOriginFailures.length === 0, `${key}: same-origin network errors: ${[...cold.sameOriginFailures, ...warm.sameOriginFailures].join(', ')}`);
  assert(cold.runtimeErrors.length === 0 && warm.runtimeErrors.length === 0, `${key}: runtime errors: ${[...cold.runtimeErrors, ...warm.runtimeErrors].join(' | ')}`);
  assert(cold.observerErrors.length === 0 && warm.observerErrors.length === 0, `${key}: window errors: ${[...cold.observerErrors, ...warm.observerErrors].join(' | ')}`);
  assert(cold.audioRequests === 0 && warm.audioRequests === 0, `${key}: MP3 requested before playback`);
  assert(page.video ? cold.videoRequests >= 1 : cold.videoRequests === 0, `${key}: the lock screen film was ${page.video ? 'not loaded' : 'loaded deep in the story'}`);
  assert(warm.firstPartyTransferBytes <= page.maxWarmFirstPartyTransferBytes, `${key}: warm first-party transfer ${warm.firstPartyTransferBytes} > ${page.maxWarmFirstPartyTransferBytes}: ${JSON.stringify(warm.firstPartyUncachedRequests.slice(0, 8))}`);
  if (idle) assert(idle.taskDuration <= 2.4, `${key}: idle TaskDuration ${idle.taskDuration.toFixed(3)}s / 3s > 2.4s`);
}

// every chapter route in every language and on three screens: it opens on its own chapter, in its language
async function runFunctionalMatrix(chrome, origin) {
  const checks = [];
  for (const viewport of functionalViewports) {
    const { client, close } = await openTab(chrome, viewport);
    try {
      for (const [lkey, prefix, htmlLang] of languages) for (const [chapter, route] of routes) {
        const key = `${viewport.key}/${lkey}${route}`, capture = capturePhase(client, origin);
        await go(client, `${origin}${prefix}${route}`, 1_600);
        const network = capture.finish();
        const s = await evaluate(client, `(() => ({ lang: document.documentElement.lang, stage: document.documentElement.classList.contains('jy-stage-mode'), narrow: document.documentElement.classList.contains('jy-narrow'), current: (document.querySelector('.jy-rail a[aria-current]') || {}).dataset?.go || '', chip: (document.getElementById('jy-mchap') || {}).textContent || '', overflow: document.documentElement.scrollWidth > innerWidth + 1, errors: (window.__ttRuntimePerf || {}).errors || [] }))()`);
        assert(s.lang === htmlLang, `${key}: html lang ${s.lang} != ${htmlLang}`);
        assert(s.stage, `${key}: the stage did not start`);
        assert(s.narrow || s.current === chapter, `${key}: opened on chapter ${s.current}, expected ${chapter}`);
        assert(!s.narrow || s.chip.trim().length > 0, `${key}: the chapter chip is empty`);
        assert(!s.overflow, `${key}: horizontal overflow`);
        assert(s.errors.length === 0 && network.runtimeErrors.length === 0, `${key}: errors ${[...s.errors, ...network.runtimeErrors].join(' | ')}`);
        assert(network.sameOriginFailures.length === 0, `${key}: failed requests ${network.sameOriginFailures.join(', ')}`);
        checks.push(key);
      }
    } finally { await close(); }
  }
  return checks;
}

// the whole story by scrolling (desktop and phone), a record played, and the inquiry refusing an empty form
async function runInteractionSmoke(chrome, origin) {
  const checks = [];
  for (const viewport of viewports) {
    const { client, close } = await openTab(chrome, viewport);
    try {
      const capture = capturePhase(client, origin);
      await go(client, `${origin}/`, 1_500);
      // (going on stops at each chapter's question and plays its scene; going back is plain scrolling, so the whole story
      // is crossed from the end back to the start, every frame of it drawn)
      await evaluate(client, `scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`);
      await sleep(1_800);
      const atEnd = await evaluate(client, `document.getElementById('jy-contact')?.classList.contains('on')`);
      const steps = 80;
      for (let i = steps - 1; i >= 0; i--) {
        await evaluate(client, `scrollTo({ top: ${i / steps} * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' })`);
        await sleep(90);
      }
      await sleep(800);
      const end = await evaluate(client, `(() => ({ errors: (window.__ttRuntimePerf || {}).errors || [] }))()`);
      assert(atEnd, `${viewport.key}: the inquiry did not come at the end of the story`);
      assert(end.errors.length === 0, `${viewport.key}: errors scrolling through the story: ${end.errors.join(' | ')}`);
      // the inquiry refuses an empty form (no request leaves)
      const sent = await evaluate(client, `(() => { const f = document.getElementById('jy-form'); if (!f) return 'no form'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); return document.querySelectorAll('#jy-form [aria-invalid="true"]').length; })()`);
      await sleep(600);
      const net1 = capture.finish();
      assert(typeof sent === 'number' && sent >= 1, `${viewport.key}: an empty inquiry was not refused (${sent})`);
      assert(!net1.requests?.some?.((r) => /web3forms/.test(r.url)), `${viewport.key}: an empty inquiry was sent`);
      assert(net1.sameOriginFailures.length === 0, `${viewport.key}: failed requests in the story: ${net1.sameOriginFailures.join(', ')}`);
      // a record plays from its card
      const capture2 = capturePhase(client, origin);
      await go(client, `${origin}/discography/`, 2_500);
      // (a real click, so the browser lets the record sound)
      const box = await evaluate(client, `(() => { const b = document.getElementById('jy-ro-play'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (box) for (const type of ['mousePressed', 'mouseReleased']) await client.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await sleep(2_000);
      const play = await evaluate(client, `(() => { const a = [...document.querySelectorAll('audio')].find((x) => x.src); return { src: a ? a.src : '', paused: a ? a.paused : true, t: a ? a.currentTime : 0 }; })()`);
      const net2 = capture2.finish();
      assert(net2.audioRequests >= 1, `${viewport.key}: playing a record requested no MP3`);
      assert(net2.sameOriginFailures.length === 0, `${viewport.key}: failed requests playing a record: ${net2.sameOriginFailures.join(', ')}`);
      checks.push(`${viewport.key}/story`, `${viewport.key}/play ${play.t > 0 ? 'playing' : 'requested'}`);
    } finally { await close(); }
  }
  return checks;
}

let serverHandle;
let chrome;
try {
  serverHandle = await startStaticServer();
  chrome = await launchChrome(await findChrome());
  const results = [];
  for (const viewport of viewports) for (const page of pages) {
    const result = await runCase(chrome, serverHandle.origin, page, viewport);
    validateResult(result);
    results.push(result);
  }
  const functionalChecks = await runFunctionalMatrix(chrome, serverHandle.origin);
  const interactionChecks = await runInteractionSmoke(chrome, serverHandle.origin);
  console.table(results.map(({ key, cold, warm, idle }) => ({
    case: key, requests: cold.requestCount, firstParty: cold.firstPartyRequestCount, googleFonts: cold.googleFontRequestCount,
    coldKB: Math.round(cold.transferBytes / 1024), warmFirstPartyKB: Math.round(warm.firstPartyTransferBytes / 1024),
    FCPms: Math.round(cold.fcp), LCPms: Math.round(cold.lcp), CLS: Number(cold.cls.toFixed(4)), longTasks: cold.longTasks, DOM: cold.domNodes,
    idleTaskMs: idle ? Math.round(idle.taskDuration * 1000) : '',
  })));
  if (errors.length) {
    console.error(`Runtime performance validation failed:\n- ${errors.join('\n- ')}`);
    if (process.env.GITHUB_ACTIONS) for (const error of errors) console.log(`::error title=Runtime check::${String(error).replace(/\r?\n/g, ' ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Runtime performance validation passed: ${results.length} cold/warm performance cases, ${functionalChecks.length} route/language/viewport checks and ${interactionChecks.length} interaction checks.`);
  }
} finally {
  if (chrome) await chrome.close();
  if (serverHandle) await new Promise((resolve) => serverHandle.server.close(resolve));
}
