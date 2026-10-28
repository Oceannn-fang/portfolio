/**
 * 调试：为什么点击著作行没有打开 .pom-overlay，以及 DriftWall 何时挂载
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
  async waitFor(expr, timeoutMs = 20000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { try { if (await this.eval(expr)) return true; } catch {} await sleep(150); }
    throw new Error(`等待超时: ${expr}`);
  }
}

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');

(async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); setTimeout(() => rej(new Error('WS超时')), 8000); });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await cdp.waitFor('document.querySelectorAll(\'ul.work li[data-viewer="portfolio"]\').length > 0', 40000);
  await sleep(2000);

  const probe = async (label) => {
    const d = await cdp.eval(`(() => ({
      overlay: !!document.querySelector('.pom-overlay'),
      overlayImgs: document.querySelectorAll('.pom-overlay img').length,
      overlayHTML: (document.querySelector('.pom-overlay')?.innerHTML || '').slice(0, 160),
      single: !!document.querySelector('.pom-single-img'),
      pomRoot: document.querySelectorAll('.pom-root').length,
      thumbImgs: [...document.querySelectorAll('img')].filter(i => (i.getAttribute('src')||'').includes('portfolio-thumbs')).length,
      tilt: document.querySelectorAll('.tilted-card-img').length,
    }))()`);
    console.log(label, JSON.stringify(d));
    return d;
  };

  console.log('=== 初始（未 hover）===');
  await probe('  初始');

  // 直接点击第一行（不先 hover）
  const box = await cdp.eval(`(() => {
    const el = document.querySelector('ul.work li[data-viewer="portfolio"]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), text: el.innerText.trim() };
  })()`);
  console.log('  目标行:', JSON.stringify(box));
  await sleep(400);
  const box2 = await cdp.eval(`(() => {
    const el = document.querySelector('ul.work li[data-viewer="portfolio"]');
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + r.height/2));
    return { y: Math.round(r.top + r.height/2), atTag: at ? at.tagName : null, atCls: at ? String(at.className).slice(0,80) : null };
  })()`);
  console.log('  该点上的元素:', JSON.stringify(box2));

  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box2.y, buttons: 0 });
  await sleep(600);
  console.log('=== hover 后 ===');
  await probe('  hover后');

  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box2.y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(80);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box2.y, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(1500);
  console.log('=== 点击后 ===');
  await probe('  点击后');

  ws.close();
  process.exit(0);
})().catch((e) => { console.error('异常:', e.stack || e); process.exit(3); });
