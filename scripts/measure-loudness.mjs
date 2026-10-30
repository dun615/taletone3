// Measures every work's audio (ITU-R BS.1770 / EBU R128 integrated loudness and sample peak) and writes the
// gain that brings it to the target into the works data, so Works plays every record at the same loudness
// without re-encoding the files:
//
//   CHROME_PATH=/path/to/chrome node scripts/measure-loudness.mjs [works-data.json ...]
//
// Default file: assets/data/works-data.json. Writes `loudness`: { target, ceiling, files: { <audio path>:
// { lufs, peak, trim?, gain } } }, gain in dB = target - lufs + trim, lowered when a quiet file would push its sample
// peak above the ceiling. `trim` (dB) is a by-ear correction kept across runs: LUFS (and the ISO 532-1 loudness
// checked against it) leave about ±1 dB that tone alone makes a record feel louder or smaller. Run it again after
// adding or replacing an audio file. The browser decodes only, muted.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TARGET = -14;   // LUFS, integrated
const CEILING = -1;   // dBFS, sample peak after the gain

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['assets/data/works-data.json'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 10) / 10;

function audioPaths(data) {
  const out = new Set();
  const add = (item) => { if (item && item.audio) out.add(item.audio); };
  for (const work of data.works || []) {
    add(work);
    (work.versions || []).forEach(add);
    for (const track of work.tracks || []) { add(track); (track.versions || []).forEach(add); }
  }
  return [...out];
}

async function launch() {
  const chromePath = process.env.CHROME_PATH;
  if (!chromePath) throw new Error('Set CHROME_PATH to a Chrome, Chromium or Edge executable.');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'taletone-loudness-'));
  const child = spawn(chromePath, ['--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore', windowsHide: true });
  let port = 0;
  for (let i = 0; i < 200 && !port; i++) {
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]); } catch { await sleep(50); }
  }
  if (!port) throw new Error('the browser did not open a debugging port');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', (event) => { const m = JSON.parse(String(event.data)); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.result?.exceptionDetails ? reject(new Error(m.result.exceptionDetails.exception?.description || 'evaluate failed')) : resolve(m.result?.result?.value)));
    socket.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  return {
    evaluate,
    async close() {
      socket.close(); child.kill();
      await sleep(300);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// Runs in the page: decode at 48 kHz, K-weight, 400 ms blocks with 75 % overlap, absolute (-70) and relative (-10) gates.
function analyse(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes.buffer).then((buffer) => {
    const rate = buffer.sampleRate, channels = [];
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const x = buffer.getChannelData(c), y = new Float32Array(x.length);
      // stage 1: high shelf; stage 2: RLB high-pass (BS.1770 coefficients at 48 kHz)
      const stages = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]],
        [[1, -2, 1], [-1.99004745483398, 0.99007225036621]]];
      let input = x;
      for (const [[b0, b1, b2], [a1, a2]] of stages) {
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < input.length; i++) {
          const v = input[i], out = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          x2 = x1; x1 = v; y2 = y1; y1 = out; y[i] = out;
        }
        input = y.slice();
      }
      for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
      channels.push(input);
    }
    const block = Math.round(rate * 0.4), step = Math.round(rate * 0.1), powers = [];
    for (let start = 0; start + block <= buffer.length; start += step) {
      let sum = 0;
      for (const ch of channels) { let s = 0; for (let i = start; i < start + block; i++) s += ch[i] * ch[i]; sum += s / block; }
      powers.push(sum);
    }
    const loud = (p) => -0.691 + 10 * Math.log10(p);
    const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
    const abs = powers.filter((p) => loud(p) > -70);
    const relative = loud(mean(abs)) - 10;
    const gated = abs.filter((p) => loud(p) > relative);
    return { lufs: loud(mean(gated)), peak: 20 * Math.log10(peak), seconds: buffer.duration };
  });
}

const browser = await launch();
try {
  for (const file of files) {
    const data = JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, ''));
    const measured = {}, previous = (data.loudness && data.loudness.files) || {};
    for (const audio of audioPaths(data)) {
      const base64 = (await readFile(audio)).toString('base64');
      const { lufs, peak, seconds } = await browser.evaluate(`(${analyse.toString()})(${JSON.stringify(base64)})`);
      const trim = Number(previous[audio] && previous[audio].trim) || 0;
      let gain = TARGET - lufs + trim;
      if (peak + gain > CEILING) gain = CEILING - peak;
      measured[audio] = Object.assign({ lufs: round(lufs), peak: round(peak) }, trim ? { trim } : {}, { gain: round(gain) });
      console.log(`${round(lufs).toFixed(1).padStart(6)} LUFS  peak ${round(peak).toFixed(1).padStart(5)} dBFS  gain ${round(gain).toFixed(1).padStart(5)} dB  ${seconds.toFixed(0)}s  ${path.basename(audio)}`);
    }
    data.loudness = { target: TARGET, ceiling: CEILING, files: measured };
    await writeFile(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`${file}: ${Object.keys(measured).length} files`);
  }
} finally {
  await browser.close();
}
