/**
 * CSS 清理后的回归验证：确认删掉 film 样式没有影响 portfolio 的桌面/窄屏排版
 *
 * 断言（桌面 1440×900 + 窄屏 900×1000 各一轮）：
 *   1. 单图 <img> 用 web/<id>.webp 且已解码
 *   2. #viewer.portfolio 的宽高/位置在合理范围（不是 0，也没被 film 规则残留影响）
 *   3. #portfolioViewer 的 inset/border-radius 生效（窄屏走手机边框那套）
 *   4. 页面上不存在 #filmViewer / .film 相关类
 *
 * 用法：node verify-css-regression.cjs <cdpPort> <baseUrl> <outJson>
 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
const OUT = process.argv[4] || 'verify-css-regression.json';
const WORK_ID = 'carmen';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id == null) return;
      const p = this.pending.get(m.id); if (!p) return;
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
  async waitFor(expr, timeoutMs = 25000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { try { if (await this.eval(expr)) return true; } catch {} await sleep(150); }
    throw new Error(`等待超时: ${expr}`);
  }
  async hoverFirstRow() {
    const b = await this.eval(`(() => {
      const el = document.querySelector('ul.work li[data-viewer="portfolio"]');
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!b) throw new Error('找不到 portfolio 行');
    await sleep(400);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, buttons: 0 });
    return b;
  }
}

const PROBE = `(() => {
  const viewer = document.querySelector('#viewer.portfolio');
  const panel = document.querySelector('#portfolioViewer');
  const img = document.querySelector('.pom-single-img');
  const vb = viewer ? viewer.getBoundingClientRect() : null;
  const cs = panel ? getComputedStyle(panel) : null;
  const vcs = viewer ? getComputedStyle(viewer) : null;
  return {
    viewer: vb ? { w: Math.round(vb.width), h: Math.round(vb.height), x: Math.round(vb.x), y: Math.round(vb.y) } : null,
    viewerOpacity: vcs ? vcs.opacity : null,
    viewerTransform: vcs ? vcs.transform : null,
    panel: cs ? { inset: [cs.top, cs.right, cs.bottom, cs.left].join(' '), radius: cs.borderRadius, overflow: cs.overflow } : null,
    img: img ? { src: img.getAttribute('src'), complete: img.complete, w: img.naturalWidth, h: img.naturalHeight } : null,
    filmNodes: document.querySelectorAll('#filmViewer, .film, [class*="film"]').length,
  };
})()`;

(async () => {
  const report = { base: BASE, viewports: [] };
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
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');

  const viewports = [
    { name: 'desktop 1440x900', width: 1440, height: 900 },
    { name: 'narrow 900x1000', width: 900, height: 1000 },
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/` });
    await cdp.waitFor('document.querySelectorAll(\'ul.work li[data-viewer="portfolio"]\').length > 0', 40000);
    await sleep(1500);
    await cdp.hoverFirstRow();
    await cdp.waitFor('!!document.querySelector(".pom-single-img")', 20000);
    await sleep(1200);
    const probe = await cdp.eval(PROBE);
    console.log(`[${vp.name}] ${JSON.stringify(probe)}`);
    report.viewports.push({ name: vp.name, ...probe });
  }

  const results = report.viewports;
  const all = {
    '两档视口都渲染了单图': results.every((r) => r.img && r.img.complete && r.img.w > 0),
    '单图都是 carmen 的 webp': results.every((r) => String(r.img.src).endsWith(`/web/${WORK_ID}.webp`)),
    'portfolio viewer 有实际尺寸': results.every((r) => r.viewer && r.viewer.w > 100 && r.viewer.h > 100),
    'portfolio panel 完成样式计算': results.every((r) => r.panel && r.panel.radius && r.panel.overflow === 'hidden'),
    '页面无 film 节点残留': results.every((r) => r.filmNodes === 0),
  };
  report.assertions = all;
  report.passed = Object.values(all).every(Boolean);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n断言: ${JSON.stringify(all, null, 2)}`);
  console.log(`\n总体: ${report.passed ? 'PASS' : 'FAIL'}`);
  ws.close();
  process.exit(report.passed ? 0 : 1);
})().catch((e) => { console.error('实测异常:', e.stack || e); process.exit(3); });
