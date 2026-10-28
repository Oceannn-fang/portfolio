/**
 * 核对 works 列表的**实际渲染顺序**
 *
 * 断言：
 *   1. 第一条是「應該」（最新作品）
 *   2. 「一夜情」紧邻在「晚餐見」之前
 *   3. 「一夜情」前面一条是 i-did-this-i-did-that（即没有跑到最顶）
 *
 * 用法：node verify-order.cjs <cdpPort> <baseUrl> <outJson>
 */
const fs = require('node:fs');

const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
const OUT = process.argv[4] || 'verify-order.json';
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
  async waitFor(expr, timeoutMs = 30000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { try { if (await this.eval(expr)) return true; } catch {} await sleep(150); }
    throw new Error(`等待超时: ${expr}`);
  }
}

(async () => {
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await cdp.waitFor('document.querySelectorAll(\'ul.work li[data-viewer="portfolio"]\').length > 0', 40000);
  await sleep(1500);

  const order = await cdp.eval(`(() => [...document.querySelectorAll('ul.work li[data-viewer="portfolio"]')].map(el => el.innerText.trim()))()`);
  console.log('实际渲染顺序:');
  order.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t}`));

  const idx = (t) => order.indexOf(t);
  const iNew = idx('一夜情');
  const iDinner = idx('晚餐見');
  const iFirst = 0;

  const report = {
    order,
    assertions: {
      '第一条是「應該」': order[0] === '應該',
      '「一夜情」在「晚餐見」之前': iNew !== -1 && iDinner !== -1 && iNew === iDinner - 1,
      '「一夜情」不在最顶': iNew > iFirst,
      '前面一条是 i-did-this-i-did-that': iNew > 0 && order[iNew - 1].toLowerCase().includes('did this, i did that'),
    },
  };
  report.passed = Object.values(report.assertions).every(Boolean);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n断言: ${JSON.stringify(report.assertions, null, 2)}`);
  console.log(`\n总体: ${report.passed ? 'PASS' : 'FAIL'}`);
  ws.close();
  process.exit(report.passed ? 0 : 1);
})().catch((e) => { console.error('实测异常:', e.stack || e); process.exit(3); });
