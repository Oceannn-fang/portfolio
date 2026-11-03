/**
 * 验证新作品在展示路径上的接入（通用版，标题与 id 由参数传入）
 *
 * 断言：
 *   1. works 列表第一条是目标作品
 *   2. DriftWall 含该作品缩略图（注意：DriftWall 随 viewer 挂载，必须在 hover 后量）
 *   3. 单图 <img> 指向 web/<id>.webp 且已解码 1080×1920
 *   4. 大图浮层同样用 .webp
 *   5. 全程未请求该作品的原图 .png
 *
 * 用法：node verify-new-work.cjs <cdpPort> <baseUrl> <workTitle> <workId> <outJson>
 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
const TITLE = process.argv[4];
const WORK_ID = process.argv[5];
const OUT = process.argv[6] || 'verify-new-work.json';
const SHOTS = path.join(__dirname, 'shots') + path.sep;
fs.mkdirSync(SHOTS, { recursive: true });
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
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch {}
      await sleep(150);
    }
    throw new Error(`等待超时: ${expr}`);
  }
  async box(selector) {
    return this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
  }
  async hover(selector) {
    const b = await this.box(selector);
    if (!b) throw new Error(`元素不存在: ${selector}`);
    await sleep(400);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, buttons: 0 });
    return b;
  }
  async click(selector) {
    // hover 会改变行高/布局，必须重新量坐标再按下
    await this.hover(selector);
    await sleep(450);
    const b = await this.box(selector);
    if (!b) throw new Error(`点击前元素消失: ${selector}`);
    if (b.y < 0 || b.y > 900) throw new Error(`点击前元素不在视口: y=${b.y}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, buttons: 0 });
    await sleep(150);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1, buttons: 1 });
    await sleep(60);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1, buttons: 0 });
    return b;
  }
  async shot(file) {
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'png' }, 10000);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    } catch (err) { return `unavailable: ${err.message}`; }
  }
}

// URL 里的中文会被百分号编码，必须先解码再匹配，否则过滤永远为空（会得到假的"未请求 PNG"结论）
const RESOURCES = `(() => performance.getEntriesByType('resource')
  .map((e) => ({ decoded: decodeURIComponent(e.name), transferSize: e.transferSize }))
  .filter((e) => e.decoded.includes('portfolio')))()`;

(async () => {
  const report = { base: BASE, work: TITLE, steps: [] };
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
  await cdp.waitFor('document.querySelectorAll(\'ul.work li[data-viewer="portfolio"]\').length > 0', 40000);
  await sleep(1800);
  await cdp.eval('performance.clearResourceTimings()');

  // 1) 列表第一条
  const firstRow = await cdp.eval(`(() => {
    const items = [...document.querySelectorAll('ul.work li[data-viewer="portfolio"]')];
    return items.length ? { count: items.length, first: items[0].innerText.trim() } : null;
  })()`);
  step('works 列表', firstRow);

  // 2)+3) hover 第一行 → DriftWall 与单图
  await cdp.hover('ul.work li[data-viewer="portfolio"]');
  await cdp.waitFor('!!document.querySelector(".pom-single-img")', 20000);
  await sleep(1500);

  const tiles = await cdp.eval(`(() => {
    const imgs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(s => s && s.includes('portfolio-thumbs'));
    return { count: imgs.length, first: imgs[0] || null, hasNew: imgs.some(s => s.includes(${JSON.stringify(WORK_ID)})) };
  })()`);
  step('DriftWall 缩略图', tiles);

  const single = await cdp.eval(`(() => {
    const img = document.querySelector('.pom-single-img');
    return img ? { src: img.getAttribute('src'), complete: img.complete, w: img.naturalWidth, h: img.naturalHeight } : null;
  })()`);
  step('单图', single);
  const shotSingle = await cdp.shot(`${SHOTS}new-work-single.png`);
  const res1 = await cdp.eval(RESOURCES);

  // 4) 浮层
  await cdp.click('ul.work li[data-viewer="portfolio"]');
  await cdp.waitFor('!!document.querySelector(".pom-overlay img")', 20000);
  await sleep(1000);
  const overlay = await cdp.eval(`(() => {
    const img = document.querySelector('.pom-overlay img');
    return img ? { src: img.getAttribute('src'), complete: img.complete, w: img.naturalWidth } : null;
  })()`);
  step('浮层', overlay);
  const res2 = await cdp.eval(RESOURCES);

  const all = [...(res1 || []), ...(res2 || [])];
  const mine = all.filter((e) => e.decoded.includes(WORK_ID));
  const pngReq = mine.filter((e) => e.decoded.endsWith('.png'));
  const webReq = mine.filter((e) => e.decoded.endsWith('.webp'));

  report.assertions = {
    '列表第一条是目标作品': !!firstRow && String(firstRow.first).toLowerCase().includes(TITLE.toLowerCase()),
    'DriftWall 含该作品缩略图': !!tiles && tiles.hasNew === true,
    '单图用 web/<id>.webp': !!single && String(single.src).endsWith(`/web/${WORK_ID}.webp`),
    '单图已解码 1080x1920': !!single && single.complete === true && single.w === 1080 && single.h === 1920,
    '浮层用 .webp': !!overlay && String(overlay.src).endsWith('.webp'),
    '未请求原图 .png': pngReq.length === 0,
    '确实发生了 .webp 请求（非空断言自检）': webReq.length > 0,
  };
  report.transfer = {
    webp请求: webReq.map((e) => ({ name: e.decoded.split('/').pop(), kb: Math.round((e.transferSize || 0) / 1024) })),
    png请求: pngReq.map((e) => e.decoded),
    该作品请求总数: mine.length,
  };
  report.shots = { single: shotSingle };
  report.passed = Object.values(report.assertions).every(Boolean);

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n断言: ${JSON.stringify(report.assertions, null, 2)}`);
  console.log(`传输: ${JSON.stringify(report.transfer, null, 2)}`);
  console.log(`\n总体: ${report.passed ? 'PASS' : 'FAIL'}`);
  ws.close();
  process.exit(report.passed ? 0 : 1);
})().catch((err) => { console.error('实测异常:', err && err.stack ? err.stack : err); process.exit(3); });
