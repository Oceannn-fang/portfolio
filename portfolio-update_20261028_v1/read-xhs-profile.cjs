/**
 * 读取小红书主页的笔记列表（临时浏览器实例，不用你的主 Chrome 配置）
 *
 * 只做只读抓取：导航 → 等待渲染 → 导出笔记标题/链接 → 截图
 * 如果遇到登录墙，如实报告，不尝试绕过。
 *
 * 用法：node read-xhs-profile.cjs <cdpPort> <profileUrl> <outDir>
 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9333);
const URL_ = process.argv[3];
const OUTDIR = process.argv[4] || __dirname;
fs.mkdirSync(OUTDIR, { recursive: true });
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

  // 等列表渲染（最多 25s），同时容忍登录墙
  const deadline = Date.now() + 25000;
  let state = null;
  while (Date.now() < deadline) {
    state = await cdp.eval(`(() => ({
      url: location.href,
      loginWall: !!document.querySelector('.login-container, .login-box, [class*="loginModal"], .mask.login'),
      noteItems: document.querySelectorAll('section.note-item, .note-item').length,
      title: document.title,
    }))()`);
    if (state.noteItems > 0) break;
    await sleep(800);
  }
  await sleep(1500);

  const detail = await cdp.eval(`(() => {
    const items = [...document.querySelectorAll('section.note-item, .note-item')];
    return items.map((el, i) => {
      const t = el.querySelector('.title, .note-title, [class*="title"]');
      const a = el.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]');
      const img = el.querySelector('img');
      return {
        i,
        text: (t ? t.innerText : el.innerText).replace(/\\s+/g, ' ').trim().slice(0, 80),
        href: a ? a.getAttribute('href') : null,
        cover: img ? (img.getAttribute('src') || '').slice(0, 120) : null,
      };
    });
  })()`);

  const shot = await (async () => {
    try {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, 12000);
      const f = path.join(OUTDIR, 'xhs-profile.png');
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return f;
    } catch (e) { return `unavailable: ${e.message}`; }
  })();

  const report = { requested: URL_, finalUrl: state && state.url, pageTitle: state && state.title, loginWall: !!(state && state.loginWall), noteCount: detail.length, notes: detail, screenshot: shot };
  fs.writeFileSync(path.join(OUTDIR, 'xhs-profile.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
  ws.close();
})().catch((e) => { console.error('异常:', e.stack || e); process.exit(1); });
