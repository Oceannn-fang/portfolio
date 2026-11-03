/**
 * 窄屏 900x1000 下确认 portfolio viewer 能否正常滑入
 *
 * 背景：上一轮 verify-css-regression 在窄屏探到 #viewer.portfolio 的 opacity=0，
 * 需要判断是「我的 CSS 清理造成的回归」还是「hover 目标不对（该 hover 行标题 h2 而不是 li）」。
 *
 * 做法：分别 hover 行标题 h2 与 li 项，观察 body.viewing 与 viewer 的 transform/opacity。
 */
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
  async hoverSelector(sel) {
    const b = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!b) return null;
    await sleep(350);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, buttons: 0 });
    return b;
  }
}

const PROBE = `(() => {
  const v = document.querySelector('#viewer.portfolio');
  const cs = v ? getComputedStyle(v) : null;
  return {
    bodyViewing: document.body.classList.contains('viewing'),
    opacity: cs ? cs.opacity : null,
    transform: cs ? cs.transform : null,
    hasSingle: !!document.querySelector('.pom-single-img'),
    hasDrift: !!document.querySelector('.pom-root'),
  };
})()`;

(async () => {
  const PORT = Number(process.argv[2] || 9333);
  const BASE = process.argv[3] || 'http://127.0.0.1:3211';
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  for (let i = 0; i < 40; i++) {
    await sleep(800);
    if (await cdp.eval(`document.querySelectorAll('ul.work li[data-viewer="portfolio"]').length > 0`)) break;
  }
  await sleep(1500);
  console.log('初始           ', JSON.stringify(await cdp.eval(PROBE)));

  // A) hover 行标题 h2（官方"总览"触发器）
  await cdp.hoverSelector('ul.work li[data-viewer="portfolio"] h2');
  await sleep(1400);
  console.log('hover 行标题 h2 ', JSON.stringify(await cdp.eval(PROBE)));

  // B) hover li 项（选中单件作品）
  await cdp.hoverSelector('ul.work li[data-viewer="portfolio"]');
  await sleep(1400);
  console.log('hover li 项     ', JSON.stringify(await cdp.eval(PROBE)));

  ws.close();
  process.exit(0);
})().catch((e) => { console.error('异常:', e.stack || e); process.exit(3); });
