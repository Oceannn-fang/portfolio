/**
 * 作品集图片路径实测：确认展示用的是 WebP 衍生图，而不是 PNG 原图
 *
 * 断言：
 *   1. hover 作品行后，单图 <img> 的 src 指向 /images/portfolio/web/*.webp
 *   2. 同一作品**从未请求过** /images/portfolio/*.png（这是本次修复的核心）
 *   3. 点击行后的大图浮层同样使用 .webp
 *   4. 报告实际传输字节（transferSize）与原图体积的对比
 *
 * 用法：node verify-portfolio-web.cjs <cdpPort> <baseUrl> <outJson>
 * 前置：Chrome 带 --remote-debugging-port 启动；next start 已在 baseUrl 运行
 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
const OUT = process.argv[4] || 'verify-portfolio-web.json';
const SHOTS = path.join(__dirname, 'shots') + path.sep;
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id == null) return;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
  }
  send(method, params = {}, timeoutMs = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP 超时: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async waitFor(expr, timeoutMs = 20000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch { /* 页面切换中 */ }
      await sleep(150);
    }
    throw new Error(`等待超时: ${expr}`);
  }
  async shot(file) {
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'png' }, 10000);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    } catch (err) {
      return `unavailable: ${err.message}`;
    }
  }
  /** 把鼠标移到元素中心（触发 React 的 onMouseEnter）；先滚进视口，否则坐标落在视口外无效 */
  async hoverSelector(selector) {
    await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    })()`);
    await sleep(500);
    const box = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!box) throw new Error(`元素不存在: ${selector}`);
    if (box.y < 0 || box.y > 900) throw new Error(`元素仍不在视口内: ${selector} y=${box.y}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 });
    return box;
  }
  async clickSelector(selector) {
    const box = await this.hoverSelector(selector);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 0 });
    return box;
  }
}

const RESOURCES = `(() => performance.getEntriesByType('resource')
  .map((e) => ({ name: e.name, type: e.initiatorType, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, duration: Math.round(e.duration) }))
  .filter((e) => e.name.includes('/images/portfolio')))()`;

(async () => {
  const report = { base: BASE, steps: [] };
  const step = (name, data) => { report.steps.push({ name, ...data }); console.log(`[${name}] ${JSON.stringify(data)}`); };

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有 page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WS 连接失败')), { once: true });
    setTimeout(() => rej(new Error('WS 打开超时')), 8000);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await cdp.waitFor('document.querySelectorAll(\'ul.work li[data-viewer="portfolio"]\').length > 0', 30000);
  await sleep(1500);
  await cdp.eval('performance.clearResourceTimings()');

  const rowSelector = 'ul.work li[data-viewer="portfolio"]';
  const rowBox = await cdp.hoverSelector(rowSelector);
  step('hover 作品行', rowBox);

  await cdp.waitFor('!!document.querySelector(".pom-single-img")', 15000);
  await sleep(1200);

  const single = await cdp.eval(`(() => {
    const img = document.querySelector('.pom-single-img');
    return img ? { src: img.getAttribute('src'), currentSrc: img.currentSrc, complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : null;
  })()`);
  step('单图元素', single);
  const shotSingle = await cdp.shot(`${SHOTS}portfolio-single.png`);

  const resSingle = await cdp.eval(RESOURCES);
  step('单图阶段的图片请求', resSingle);

  // 点击同一行 → 大图浮层
  await cdp.clickSelector(rowSelector);
  await cdp.waitFor('!!document.querySelector(".pom-overlay img")', 15000);
  await sleep(800);
  const overlay = await cdp.eval(`(() => {
    const img = document.querySelector('.pom-overlay img');
    return img ? { src: img.getAttribute('src'), complete: img.complete, naturalWidth: img.naturalWidth } : null;
  })()`);
  step('浮层图元素', overlay);
  const shotOverlay = await cdp.shot(`${SHOTS}portfolio-overlay.png`);

  const resAll = await cdp.eval(RESOURCES);
  step('全部图片请求', resAll);

  const pngRequests = resAll.filter((e) => e.name.endsWith('.png'));
  const webpRequests = resAll.filter((e) => e.name.endsWith('.webp') && e.name.includes('/portfolio/web/'));

  report.assertions = {
    '单图使用 .webp': !!single && String(single.src || '').includes('/images/portfolio/web/') && String(single.src).endsWith('.webp'),
    '单图已解码（naturalWidth>0）': !!single && single.naturalWidth > 0,
    '浮层使用 .webp': !!overlay && String(overlay.src || '').endsWith('.webp'),
    '未请求任何 PNG 原图': pngRequests.length === 0,
    '确有 webp 请求': webpRequests.length > 0,
  };
  report.transfer = {
    webp请求数: webpRequests.length,
    webp传输字节: webpRequests.reduce((s, e) => s + (e.transferSize || 0), 0),
    png请求数: pngRequests.length,
    png请求: pngRequests.map((e) => e.name),
    webp明细: webpRequests.map((e) => ({ name: e.name.split('/').pop(), kb: Math.round((e.transferSize || 0) / 1024), ms: e.duration })),
  };
  report.shots = { single: shotSingle, overlay: shotOverlay };
  report.passed = Object.values(report.assertions).every(Boolean);

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n断言: ${JSON.stringify(report.assertions, null, 2)}`);
  console.log(`传输: ${JSON.stringify(report.transfer, null, 2)}`);
  console.log(`\n总体: ${report.passed ? 'PASS' : 'FAIL'}  报告: ${OUT}`);
  ws.close();
  process.exit(report.passed ? 0 : 1);
})().catch((err) => { console.error('实测异常:', err && err.stack ? err.stack : err); process.exit(3); });
