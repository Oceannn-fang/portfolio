/**
 * 胶片带网格诊断：视口、CSS 规则是否命中、齿孔伪元素、列数切换的真实计算值
 * 用法：node diag-strip.cjs <cdpPort> <baseUrl>
 */
const PORT = Number(process.argv[2] || 9333);
const BASE = (process.argv[3] || 'http://127.0.0.1:3211').replace(/\/$/, '');
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
      try { if (await this.eval(expr)) return true; } catch { /* 切换中 */ }
      await sleep(150);
    }
    throw new Error(`等待超时: ${expr}`);
  }
}

const PROBE = `(() => {
  const row = document.querySelector('.far-strip-row');
  const strip = document.querySelector('.far-strip');
  const btn6 = [...document.querySelectorAll('.far-strip-density button')].find((b) => b.textContent.trim() === '6');
  const selectors = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.selectorText && rule.selectorText.includes('far-strip')) selectors.push(rule.selectorText);
    }
  }
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    pagePadding: getComputedStyle(document.querySelector('.far-page')).paddingLeft,
    strips: document.querySelectorAll('.far-strip').length,
    frames: document.querySelectorAll('.far-strip-frame').length,
    activeDensity: (() => { const b = document.querySelector('.far-strip-density button.is-active'); return b ? b.textContent.trim() : null; })(),
    rowInlineStyle: row ? row.getAttribute('style') : null,
    rowGridColumns: row ? getComputedStyle(row).gridTemplateColumns : null,
    rowWidth: row ? Math.round(row.getBoundingClientRect().width) : null,
    frameWidth: document.querySelector('.far-strip-frame') ? Math.round(document.querySelector('.far-strip-frame').getBoundingClientRect().width) : null,
    stripBeforeBg: strip ? getComputedStyle(strip, '::before').backgroundImage : null,
    stripBeforeContent: strip ? getComputedStyle(strip, '::before').content : null,
    stripBeforeHeight: strip ? getComputedStyle(strip, '::before').height : null,
    farStripSelectorsInCSS: selectors,
    btn6Text: btn6 ? btn6.textContent.trim() : null,
    btn6Disabled: btn6 ? btn6.disabled : null,
  };
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
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 强制一个确定的视口（不依赖窗口大小）
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `${BASE}/film/roll-017` });
  await cdp.waitFor('document.querySelectorAll(".far-strip-frame").length === 40');
  await cdp.eval('window.localStorage.removeItem("far-strip-columns")');
  await cdp.send('Page.reload', { ignoreCache: true });
  await cdp.waitFor('document.querySelectorAll(".far-strip-frame").length === 40');
  await sleep(400);

  console.log('=== 默认态（1440x900）===');
  console.log(JSON.stringify(await cdp.eval(PROBE), null, 2));

  await cdp.eval(`[...document.querySelectorAll('.far-strip-density button')].find((b) => b.textContent.trim() === '6').click()`);
  await sleep(700);
  console.log('\n=== 点击 6 列后 ===');
  console.log(JSON.stringify(await cdp.eval(PROBE), null, 2));

  ws.close();
  process.exit(0);
})().catch((e) => { console.error('诊断异常:', e && e.stack ? e.stack : e); process.exit(3); });
