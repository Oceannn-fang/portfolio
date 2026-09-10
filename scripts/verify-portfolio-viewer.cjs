// 验证 portfolio viewer（DriftWall）集成：桌面端 hover 行为 + 窄屏手机边框几何
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3000';
const profile = path.join(os.tmpdir(), `pom-cdp-${Date.now()}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.consoleErrors = [];
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (!message.method) return;
      for (const handler of this.listeners.get(message.method) || []) handler(message.params);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const d = message.params.exceptionDetails;
        this.consoleErrors.push(d.exception?.description || d.text || 'Runtime exception');
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, fn) {
    const handler = (params) => { this.off(method, handler); fn(params); };
    this.on(method, handler);
  }
  on(method, fn) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(fn);
    this.listeners.set(method, handlers);
  }
  off(method, fn) {
    this.listeners.set(method, (this.listeners.get(method) || []).filter((h) => h !== fn));
  }
  close() { this.ws.close(); }
}

function waitForChromeDebugUrl(chrome) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome CDP startup timed out')), 20000);
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => {
      const match = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}`)); });
  });
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Evaluation failed');
  return response.result.value;
}

async function screenshot(cdp, file) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

// 在元素中心派发鼠标事件（React 合成事件走 DOM 冒泡，无需真实光标坐标）
async function hoverSelector(cdp, selector) {
  return evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mouseenter', opts));
    el.dispatchEvent(new MouseEvent('mousemove', opts));
    return true;
  })()`);
}

async function unhover(cdp) {
  await evaluate(cdp, `(() => {
    const opts = { bubbles: true, cancelable: true, clientX: 5, clientY: 5 };
    document.querySelectorAll('.row h2, .work-wrapper li, #portfolioViewer').forEach((el) => {
      el.dispatchEvent(new MouseEvent('mouseout', opts));
      el.dispatchEvent(new MouseEvent('mouseleave', opts));
    });
  })()`);
}

const stateExpr = `(() => {
  const viewer = document.querySelector('#viewer');
  const panel = document.querySelector('#portfolioViewer');
  const wall = document.querySelector('#portfolioViewer .drift-wall');
  const single = document.querySelector('#portfolioViewer .pom-single-img');
  const frame = document.querySelector('#videoFrame');
  const tiles = document.querySelectorAll('#portfolioViewer .drift-wall__tile').length;
  const imgs = [...document.querySelectorAll('#portfolioViewer img')];
  return {
    viewerClass: viewer ? viewer.className : '',
    bodyViewing: document.body.classList.contains('viewing'),
    panel: !!panel,
    wall: !!wall,
    tiles,
    brokenTiles: imgs.filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0).length,
    single: single ? { loaded: single.complete && single.naturalWidth > 0, w: single.naturalWidth } : null,
    panelRect: panel ? (({ top, left, right, bottom, width, height }) => ({ top: Math.round(top), left: Math.round(left), right: Math.round(right), bottom: Math.round(bottom), width: Math.round(width), height: Math.round(height) }))(panel.getBoundingClientRect()) : null,
    frameRect: frame ? (({ top, left, right, bottom, width, height }) => ({ top: Math.round(top), left: Math.round(left), right: Math.round(right), bottom: Math.round(bottom), width: Math.round(width), height: Math.round(height) }))(frame.getBoundingClientRect()) : null,
    frameAfter: frame ? getComputedStyle(frame, '::after').backgroundImage.slice(0, 60) : '',
    panelBg: panel ? getComputedStyle(panel).backgroundColor : '',
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  };
})()`;

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const browserWs = await waitForChromeDebugUrl(chrome);
  const port = new URL(browserWs).port;
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' }).then((r) => r.json());
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const load = new Promise((resolve) => cdp.once('Page.loadEventFired', resolve));
  await cdp.send('Page.navigate', { url: BASE });
  await Promise.race([load, sleep(15000)]);
  await sleep(2000);
  // 首次访问会弹加载动画（.ls-root）：标记已访问后重新加载跳过
  const hasLoading = await evaluate(cdp, `!!document.querySelector('.ls-root')`);
  if (hasLoading) {
    await evaluate(cdp, `localStorage.setItem('gk3-visited','1')`);
    const reload = new Promise((resolve) => cdp.once('Page.loadEventFired', resolve));
    await cdp.send('Page.navigate', { url: BASE });
    await Promise.race([reload, sleep(15000)]);
    await sleep(2000);
  }
  // 轮询等待加载动画彻底消失（缓存预热需要拉取接口，可能耗时较长）
  for (let i = 0; i < 40; i++) {
    const still = await evaluate(cdp, `!!document.querySelector('.ls-root')`);
    if (!still) break;
    await sleep(1000);
  }
  await sleep(1000);

  const results = {};

  // ── 桌面端 ──
  await evaluate(cdp, `[...document.querySelectorAll('#main .row')].find(r => r.querySelector('h2') && r.querySelector('h2').textContent.trim() === 'works').scrollIntoView({ block: 'center' })`);
  await sleep(600);
  results.h2Found = await hoverSelector(cdp, "#main .row h2");
  // 精确 hover portfolio 行的 h2
  results.h2Found = await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('#main .row')].find(r => r.querySelector('h2') && r.querySelector('h2').textContent.trim() === 'works');
    if (!row) return false;
    const h2 = row.querySelector('h2');
    const r = h2.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    h2.dispatchEvent(new MouseEvent('mouseover', opts));
    h2.dispatchEvent(new MouseEvent('mouseenter', opts));
    h2.dispatchEvent(new MouseEvent('mousemove', opts));
    return true;
  })()`);
  await sleep(2500);
  results.desktopOverview = await evaluate(cdp, stateExpr);
  await screenshot(cdp, 'screen_portfolio_viewer_desktop_overview.png');

  // hover 第一个作品条目 → 单图模式
  results.liFound = await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('#main .row')].find(r => r.querySelector('h2') && r.querySelector('h2').textContent.trim() === 'works');
    if (!row) return false;
    const li = row.querySelector('.work-wrapper li');
    if (!li) return false;
    const r = li.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    li.dispatchEvent(new MouseEvent('mouseover', opts));
    li.dispatchEvent(new MouseEvent('mouseenter', opts));
    li.dispatchEvent(new MouseEvent('mousemove', opts));
    return true;
  })()`);
  await sleep(2000);
  results.desktopSingle = await evaluate(cdp, stateExpr);
  await screenshot(cdp, 'screen_portfolio_viewer_desktop_single.png');

  // 移出 → viewer 关闭
  await unhover(cdp);
  await sleep(600);
  results.desktopClosed = await evaluate(cdp, `!document.body.classList.contains('viewing') && !document.querySelector('#portfolioViewer')`);

  // ── 窄屏（max-aspect-ratio: 16/12 → 900x1000）──
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  await evaluate(cdp, `[...document.querySelectorAll('#main .row')].find(r => r.querySelector('h2') && r.querySelector('h2').textContent.trim() === 'works').scrollIntoView({ block: 'center' })`);
  await sleep(600);
  await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('#main .row')].find(r => r.querySelector('h2') && r.querySelector('h2').textContent.trim() === 'works');
    const h2 = row.querySelector('h2');
    const r = h2.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    h2.dispatchEvent(new MouseEvent('mouseover', opts));
    h2.dispatchEvent(new MouseEvent('mouseenter', opts));
    h2.dispatchEvent(new MouseEvent('mousemove', opts));
  })()`);
  await sleep(2500);
  results.narrowOverview = await evaluate(cdp, stateExpr);
  await screenshot(cdp, 'screen_portfolio_viewer_narrow.png');

  // 几何校验：窄屏下面板必须完全收进 videoFrame（手机边框）
  const n = results.narrowOverview;
  const fits = n.panelRect && n.frameRect &&
    n.panelRect.left >= n.frameRect.left - 1 && n.panelRect.right <= n.frameRect.right + 1 &&
    n.panelRect.top >= n.frameRect.top - 1 && n.panelRect.bottom <= n.frameRect.bottom + 1;
  const frameRatio = n.frameRect ? n.frameRect.width / n.frameRect.height : 0;

  const pass =
    results.h2Found &&
    results.desktopOverview.panel && results.desktopOverview.wall && results.desktopOverview.tiles > 20 &&
    results.desktopOverview.brokenTiles === 0 && results.desktopOverview.panelBg === 'rgb(11, 11, 9)' &&
    results.liFound && results.desktopSingle.single && results.desktopSingle.single.loaded &&
    results.desktopClosed &&
    n.panel && n.wall && fits && Math.abs(frameRatio - 1304 / 2866) < 0.02 && n.frameAfter.includes('phone-frame-2');

  console.log(JSON.stringify({ pass, fits, frameRatio: +frameRatio.toFixed(4), results, consoleErrors: cdp.consoleErrors }, null, 2));

  cdp.close();
  chrome.kill();
  await new Promise((resolve) => { if (chrome.exitCode !== null) resolve(); else chrome.once('exit', resolve); });
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  if (!pass) process.exit(1);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
