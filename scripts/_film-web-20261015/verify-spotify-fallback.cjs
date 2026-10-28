/**
 * 播放器降级验证脚本（CDP 真阻断 open.spotify.com）
 *
 * 目的：证明「国内网络下 Spotify Embed 不可达 → 自动降级为网易云搜索入口」这条链路
 * 真的会触发，而不是只在代码里看起来成立。
 *
 * 做法：启动一个独立的 Chrome 实例（独立 user-data-dir，不影响现有浏览器），
 * 用 CDP Network.setBlockedURLs 阻断 open.spotify.com，走完整用户路径：
 *   打开首页 → hover recently played 行 → 点击第一首曲目展开 → 观察 6s 超时后的降级。
 *
 * 用法：node verify-spotify-fallback.cjs <debugPort> <baseUrl> <outDir>
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9222);
const BASE = process.argv[3] || 'http://127.0.0.1:3211';
const OUT = process.argv[4] || os.tmpdir();
const PROFILE = path.join(process.env.TEMP || os.tmpdir(), 'chrome-tmp-embedtest');
const CHROME = 'C:\\Users\\86185\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function waitForDebugger(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const j = await httpJson(`http://127.0.0.1:${PORT}/json/version`);
      if (j.webSocketDebuggerUrl) return j;
    } catch {
      /* 端口还没起来 */
    }
    await sleep(400);
  }
  throw new Error(`调试端口 ${PORT} 在 ${timeoutMs}ms 内未就绪`);
}

/** 最小 CDP 客户端：发命令 + 等事件 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
        return;
      }
      for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

(async () => {
  const results = { port: PORT, base: BASE, steps: [] };
  const step = (name, data) => {
    results.steps.push({ name, ...data });
    console.log(`[step] ${name}: ${JSON.stringify(data)}`);
  };
  // 任一断言步骤抛异常也要落盘报告，避免出现「跑了但没有结论」
  const writeReport = () => {
    try {
      fs.writeFileSync(path.join(OUT, 'verify-spotify-fallback.json'), JSON.stringify(results, null, 2));
    } catch (e) {
      console.error('报告写入失败:', e.message);
    }
  };
  let wsRef = null;
  const bail = (code) => {
    writeReport();
    try { wsRef?.close(); } catch { /* 忽略 */ }
    process.exit(code);
  };

  // 清理可能残留的同 profile 进程
  spawn('taskkill', ['/FI', `WINDOWTITLE eq chrome-embedtest*`, '/F'], { stdio: 'ignore' });

  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--window-size=1440,900',
      '--remote-allow-origins=*',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' }
  );
  chrome.unref();
  results.chromePid = chrome.pid;

  const version = await waitForDebugger(30000);
  step('chrome-ready', { browser: version.Browser, ws: !!version.webSocketDebuggerUrl });

  const targets = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的 page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  wsRef = ws;
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (e) => reject(new Error('WebSocket 连接失败: ' + e.message)), { once: true });
  });
  const cdp = new Cdp(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  const blocked = [];
  cdp.on('Network.requestWillBeSent', (p) => {
    if (/open\.spotify\.com|spotifycdn|scdn\.co/.test(p.request.url)) blocked.push(p.request.url);
  });

  // 关键：阻断被墙域名，模拟国内直连
  await cdp.send('Network.setBlockedURLs', { urls: ['*://open.spotify.com/*', '*://*.spotifycdn.com/*'] });
  step('blocked-urls-set', { urls: ['*://open.spotify.com/*', '*://*.spotifycdn.com/*'] });

  try {

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(4000);

  /** 把元素滚到视口中央并返回其中心坐标（供真实鼠标事件使用） */
  const centerOf = async (selector) => {
    return cdp.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        x: Math.round(x), y: Math.round(y),
        text: (el.textContent || '').trim().slice(0, 40),
        hitIsInside: !!(top && (top === el || el.contains(top) || top.contains(el))),
        hitTag: top ? top.tagName + (top.className ? '.' + String(top.className).split(' ')[0] : '') : null,
      };
    })()`);
  };

  /** 真实鼠标移动（React onMouseEnter 依赖 mouseover 的 relatedTarget 链，合成事件无效） */
  const moveMouse = (x, y) =>
    cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });

  const realClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };

  // 打开 music viewer：真实鼠标移动到 li[data-viewer=music] 上
  const liCenter = await centerOf('li[data-viewer="music"]');
  step('locate-music-row', liCenter);
  if (!liCenter) throw new Error('li[data-viewer=music] 未找到');
  await moveMouse(liCenter.x, liCenter.y);
  await sleep(2000);
  // 移动一次以触发新一轮 mouseover（React 需要 relatedTarget 变化）
  await moveMouse(liCenter.x, liCenter.y + 2);
  await sleep(1500);

  const viewerState = await cdp.eval(`(() => {
    const v = document.querySelector('#musicViewer');
    const items = document.querySelectorAll('.mm-track-item');
    return { viewerPresent: !!v, trackCount: items.length };
  })()`);
  step('music-viewer', viewerState);

  if (!viewerState.viewerPresent || viewerState.trackCount === 0) {
    step('ABORT', { reason: '音乐面板未打开或曲目为空，后续断言无法进行' });
    fs.writeFileSync(path.join(OUT, 'verify-spotify-fallback.json'), JSON.stringify(results, null, 2));
    ws.close();
    process.exit(2);
  }

  // 点击第一首曲目 → 展开 embed（真实鼠标事件）
  const trackCenter = await centerOf('.mm-track-item');
  step('locate-track', trackCenter);
  if (!trackCenter) throw new Error('.mm-track-item 未找到');
  await moveMouse(trackCenter.x, trackCenter.y);
  await sleep(300);
  await realClick(trackCenter.x, trackCenter.y);
  await sleep(500);
  step('after-click', await cdp.eval(`(() => {
    const item = document.querySelector('.mm-track-item');
    return {
      expandedOpen: !!document.querySelector('.mm-expand.open'),
      iframePresent: !!document.querySelector('.mm-embed iframe'),
      fallbackPresent: !!document.querySelector('.mm-embed-fallback'),
      itemClass: item ? item.className : null,
    };
  })()`));

  await sleep(1200);
  const beforeTimeout = await cdp.eval(`(() => {
    const iframe = document.querySelector('.mm-embed iframe');
    return {
      iframePresent: !!iframe,
      iframeSrc: iframe ? iframe.getAttribute('src') : null,
      fallbackPresent: !!document.querySelector('.mm-embed-fallback'),
    };
  })()`);
  step('t-plus-1.2s (6s 超时前)', beforeTimeout);
  await cdp.shot(path.join(OUT, 'embed-before-timeout.jpg'));

  // 等过 6s 超时阈值
  await sleep(7000);
  const afterTimeout = await cdp.eval(`(() => {
    const iframe = document.querySelector('.mm-embed iframe');
    const fb = document.querySelector('.mm-embed-fallback');
    const links = fb
      ? [...fb.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))
      : [];
    return {
      iframePresent: !!iframe,
      fallbackPresent: !!fb,
      fallbackHeight: fb ? Math.round(fb.getBoundingClientRect().height) : null,
      links,
      text: fb ? fb.textContent.trim() : null,
    };
  })()`);
  step('t-plus-8.2s (6s 超时后)', afterTimeout);
  await cdp.shot(path.join(OUT, 'embed-after-timeout.jpg'));

  // 断言
  const assertions = {
    'iframe 在超时前已挂载': beforeTimeout.iframePresent === true,
    'iframe 指向 open.spotify.com': String(beforeTimeout.iframeSrc || '').includes('open.spotify.com'),
    '超时前未提前降级': beforeTimeout.fallbackPresent === false,
    '超时后已降级': afterTimeout.fallbackPresent === true,
    '超时后 iframe 已卸载': afterTimeout.iframePresent === false,
    '降级面板高度对齐 152px': afterTimeout.fallbackHeight === 152,
    '降级含网易云搜索链接': afterTimeout.links.some((l) => l.href?.includes('music.163.com/#/search/m/')),
    '降级含 Spotify 链接': afterTimeout.links.some((l) => l.href?.includes('open.spotify.com/track/')),
    '被阻断的 spotify 请求数': blocked.length,
  };
  results.assertions = assertions;
  results.passed = Object.entries(assertions)
    .filter(([k, v]) => typeof v === 'boolean')
    .every(([, v]) => v === true);

  console.log('\n=== 断言结果 ===');
  for (const [k, v] of Object.entries(assertions)) console.log(`  ${v === true ? 'PASS' : typeof v === 'boolean' ? 'FAIL' : 'INFO'}  ${k}: ${v}`);
  console.log(`\n总体: ${results.passed ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(path.join(OUT, 'verify-spotify-fallback.json'), JSON.stringify(results, null, 2));
  ws.close();

  // 只结束本脚本启动的实例（按 user-data-dir 精确匹配），不影响用户已有 Chrome
  // 注意 escape 必须双写反斜杠：wmic 的 LIKE 把 \ 当转义符，单写会静默匹配不到（曾导致进程残留）
  const esc = PROFILE.replace(/\\/g, '\\\\');
  spawn('wmic', ['process', 'where', `"CommandLine like '%${esc}%'"`, 'call', 'terminate'], { stdio: 'ignore' });
  await sleep(300);
  process.exit(results.passed ? 0 : 1);
  } catch (err) {
    console.error('验证步骤异常:', err && err.message ? err.message : err);
    step('EXCEPTION', { message: String(err && err.message ? err.message : err) });
    bail(4);
  }
})().catch((err) => {
  console.error('脚本异常:', err && err.stack ? err.stack : err);
  process.exit(3);
});
