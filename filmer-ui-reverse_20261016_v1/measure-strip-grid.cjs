/**
 * 胶片带网格实测（CDP）
 *
 * 目的：把「胶片带 + 列数切换」的验收项变成可复核的数字，而不是只看截图：
 *   1. 默认列数、胶片带行数、单帧尺寸
 *   2. 齿孔装饰是否真的生效（::before background-image）
 *   3. 点「6」后列数/带数是否按预期变化
 *   4. 刷新后列数偏好是否从 localStorage 恢复
 *
 * 用法：node measure-strip-grid.cjs <cdpPort> <baseUrl> <outJsonPath>
 * 前置：Chrome 已带 --remote-debugging-port 启动；next start 已在 baseUrl 运行。
 */
const fs = require('node:fs');

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
const OUT = process.argv[4] || 'measure-strip-grid.json';
const SHOTS = require('node:path').join(__dirname, 'shots') + require('node:path').sep;
fs.mkdirSync(SHOTS, { recursive: true });
const PATH = '/film/roll-017';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id == null) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    });
  }
  send(method, params = {}, timeoutMs = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 超时: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  /** 截图属辅助证据：本环境曾出现 captureScreenshot 永久不返回，失败降级为说明字符串 */
  async shot(file) {
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'png' }, 10000);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    } catch (err) {
      return `unavailable: ${err.message}`;
    }
  }
  async waitFor(expression, timeoutMs = 20000, intervalMs = 150) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await this.eval(expression)) return true;
      } catch {
        /* 页面切换中，忽略 */
      }
      await sleep(intervalMs);
    }
    throw new Error(`等待超时: ${expression}`);
  }
}

const MEASURE = `(() => {
  const rows = [...document.querySelectorAll('.far-strip-row')];
  const frames = [...document.querySelectorAll('.far-strip-frame')];
  const firstRow = rows[0];
  const firstFrame = frames[0];
  const perf = document.querySelector('.far-strip');
  const cs = firstRow ? getComputedStyle(firstRow) : null;
  const box = firstFrame ? firstFrame.getBoundingClientRect() : null;
  return {
    strips: document.querySelectorAll('.far-strip').length,
    frames: frames.length,
    columns: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : null,
    rowGap: cs ? cs.columnGap : null,
    frameSize: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
    frameAspect: box ? Number((box.width / box.height).toFixed(3)) : null,
    perforationBg: perf ? getComputedStyle(perf, '::before').backgroundImage : null,
    activeDensity: (() => {
      const b = document.querySelector('.far-strip-density button.is-active');
      return b ? b.textContent.trim() : null;
    })(),
    stored: window.localStorage.getItem('far-strip-columns'),
  };
})()`;

(async () => {
  const report = { base: BASE, path: PATH, steps: [] };
  const step = (name, data) => {
    report.steps.push({ name, ...data });
    console.log(`[${name}] ${JSON.stringify(data)}`);
  };

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
  // 固定视口：不依赖窗口实际大小（否则会量到极窄布局，得到假阴性）
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 1) 首次访问：默认列数
  await cdp.send('Page.navigate', { url: `${BASE}${PATH}` });
  await cdp.waitFor('document.querySelectorAll(".far-strip-frame").length === 40');
  // 清掉历史偏好，测默认值
  await cdp.eval('window.localStorage.removeItem("far-strip-columns")');
  await cdp.send('Page.reload', { ignoreCache: true });
  await cdp.waitFor('document.querySelectorAll(".far-strip-frame").length === 40');
  const initial = await cdp.eval(MEASURE);
  step('初次进入（无偏好）', initial);
  const shotDesktop4 = await cdp.shot(`${SHOTS}desktop-4col.png`);

  // 2) 切到 6 列
  await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('.far-strip-density button')].find((b) => b.textContent.trim() === '6');
    if (!btn) throw new Error('找不到 6 列按钮');
    btn.click();
    return true;
  })()`);
  await cdp.waitFor(`getComputedStyle(document.querySelector('.far-strip-row')).gridTemplateColumns.split(' ').filter(Boolean).length === 6`);
  const after6 = await cdp.eval(MEASURE);
  step('点击 6 列', after6);
  const shotDesktop6 = await cdp.shot(`${SHOTS}desktop-6col.png`);

  // 3) 刷新后偏好是否恢复
  await cdp.send('Page.reload', { ignoreCache: true });
  await cdp.waitFor('document.querySelectorAll(".far-strip-frame").length === 40');
  await sleep(400);
  const afterReload = await cdp.eval(MEASURE);
  step('刷新后（偏好恢复）', afterReload);

  // 3.5) 窄屏视口（AGENTS 要求桌面 1440x900 与窄屏 900x1000 都要验）
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const narrow = await cdp.eval(MEASURE);
  step('窄屏 900x1000（6 列）', narrow);
  const shotNarrow = await cdp.shot(`${SHOTS}narrow-900x1000.png`);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 4) 切到 3 列，确认最少列数也正常
  await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('.far-strip-density button')].find((b) => b.textContent.trim() === '3');
    if (!btn) throw new Error('找不到 3 列按钮');
    btn.click();
    return true;
  })()`);
  await cdp.waitFor(`getComputedStyle(document.querySelector('.far-strip-row')).gridTemplateColumns.split(' ').filter(Boolean).length === 3`);
  const after3 = await cdp.eval(MEASURE);
  step('点击 3 列', after3);

  // 5) 灯箱仍可用（点第一帧 → 出现 .far-lightbox，Esc 关闭）
  await cdp.eval('document.querySelector(".far-strip-frame").click()');
  await cdp.waitFor('!!document.querySelector(".far-lightbox")', 5000);
  step('灯箱打开', { open: true });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.waitFor('!document.querySelector(".far-lightbox")', 5000);
  step('灯箱 Esc 关闭', { closed: true });

  report.passed =
    initial.columns === 4 &&
    initial.strips === 10 &&
    initial.frames === 40 &&
    String(initial.perforationBg || '').includes('radial-gradient') &&
    after6.columns === 6 &&
    after6.strips === 7 &&
    afterReload.columns === 6 &&
    after3.columns === 3 &&
    after3.strips === 14;

  report.got = { initial, after6, afterReload, after3, narrow };
  report.shots = { desktop4: shotDesktop4, desktop6: shotDesktop6, narrow: shotNarrow };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n总体: ${report.passed ? 'PASS' : 'FAIL'}  报告: ${OUT}`);
  ws.close();
  process.exit(report.passed ? 0 : 1);
})().catch((err) => {
  console.error('实测异常:', err && err.stack ? err.stack : err);
  process.exit(3);
});
