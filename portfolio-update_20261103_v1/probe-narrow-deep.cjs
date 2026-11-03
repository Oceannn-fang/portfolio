/**
 * 深挖：窄屏 900x1000 下 .viewing #viewer.portfolio 为何没有生效
 *
 * 依次检查：选择器是否匹配、匹配到的元素、transition 时长、延长等待后是否滑入
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
}

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

  const b = await cdp.eval(`(() => {
    const el = document.querySelector('ul.work li[data-viewer="portfolio"]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await sleep(300);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, buttons: 0 });

  for (const wait of [500, 1500, 3000, 6000]) {
    await sleep(wait);
    const st = await cdp.eval(`(() => {
      const v = document.querySelector('#viewer.portfolio');
      const cs = v ? getComputedStyle(v) : null;
      return {
        matchesViewingRule: !!document.querySelector('.viewing #viewer.portfolio'),
        bodyClasses: document.body.className,
        cls: v ? v.className : null,
        opacity: cs ? cs.opacity : null,
        transform: cs ? cs.transform : null,
        transition: cs ? cs.transition.slice(0, 80) : null,
        innerW: window.innerWidth, innerH: window.innerHeight,
        mq: window.matchMedia('(max-aspect-ratio: 16/12)').matches,
      };
    })()`);
    console.log(`+${wait}ms  ${JSON.stringify(st)}`);
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('异常:', e.stack || e); process.exit(3); });
