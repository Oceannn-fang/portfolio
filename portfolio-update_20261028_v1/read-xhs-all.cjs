/**
 * 读取小红书主页全部笔记标题（只读）
 *
 * 两个坑：
 *   1. 该 Chrome 版本(124)的 Input 域（含 mouseWheel/截图）会超时 → 用 JS 滚动
 *   2. 主页是虚拟化网格：滚出视口的节点会被卸载，所以「节点数」不会增长
 *      → 改为每次滚动都抓一遍标题，累积并集（按首次出现顺序）
 *
 * 用法：node read-xhs-all.cjs <cdpPort> <profileUrl> <outDir>
 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9333);
const URL_ = process.argv[3];
const OUTDIR = process.argv[4] || __dirname;
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
  send(method, params = {}, timeoutMs = 30000) {
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
}

// 当前视口内已渲染的笔记标题
const GRAB = `(() => [...document.querySelectorAll('section.note-item, .note-item')]
  .map((el) => {
    const t = el.querySelector('.title, .note-title, [class*="title"]');
    const s = (t ? t.innerText : el.innerText).replace(/\\s+/g, ' ').trim();
    return s.slice(0, 90);
  })
  .filter((s) => s.length > 0))()`;

const SCROLL = `(() => {
  const el = document.scrollingElement || document.documentElement;
  el.scrollTop = el.scrollTop + Math.round(window.innerHeight * 0.85);
  window.scrollBy(0, Math.round(window.innerHeight * 0.85));
  return Math.round(el.scrollTop);
})()`;

(async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WS 失败')), { once: true });
    setTimeout(() => rej(new Error('WS 超时')), 8000);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: URL_ });

  // 等首屏
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const n = await cdp.eval(`document.querySelectorAll('section.note-item, .note-item').length`);
    if (n > 0) { console.log(`  首屏 ${n} 条`); break; }
  }

  const seen = [];
  const seenSet = new Set();
  const addAll = (arr) => {
    for (const s of arr) {
      const key = s.replace(/[\s\-–—_，,。.、]/g, '').toLowerCase();
      if (!seenSet.has(key)) { seenSet.add(key); seen.push(s); }
    }
  };

  addAll(await cdp.eval(GRAB));

  let stagnant = 0;
  for (let round = 0; round < 40 && stagnant < 6; round++) {
    const before = seen.length;
    await cdp.eval(SCROLL);
    await sleep(1300);
    addAll(await cdp.eval(GRAB));
    const grew = seen.length - before;
    if (grew === 0) stagnant++; else stagnant = 0;
    if (round % 5 === 0 || grew > 0) console.log(`  第 ${round + 1} 轮：新增 ${grew}，累计 ${seen.length}`);
  }

  const profileName = await cdp.eval(`(() => { const el = document.querySelector('.user-name, [class*="user-name"]'); return el ? el.innerText.trim() : document.title; })()`);
  const declared = await cdp.eval(`(() => { const el = document.querySelector('[class*="total"], .total'); return el ? el.innerText.trim() : null; })()`);

  const report = { profileName, declaredTotal: declared, collected: seen.length, notes: seen };
  fs.writeFileSync(path.join(OUTDIR, 'xhs-profile-full.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n用户: ${profileName}  页面标注: ${declared || '(无)'}  累计收集: ${seen.length} 条`);
  ws.close();
})().catch((e) => { console.error('异常:', e.stack || e); process.exit(1); });
