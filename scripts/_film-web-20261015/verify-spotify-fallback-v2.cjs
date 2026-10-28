/**
 * Spotify Embed 降级链路验证 v2（三种网络失败模式插桩取证）
 *
 * 为什么需要 v2：v1（verify-spotify-fallback.cjs）只覆盖了「CDP 阻断」一种失败模式，
 * 而「CDP 阻断」与「国内 DNS 污染 / TCP 黑洞」在浏览器里触发的 DOM 事件**并不相同**。
 * v1 的断言全部围绕 onError → 定时器这条路径，等于用被测假设本身当验证前提。
 * v2 改为先**测量**，再断言：
 *
 *   mode = real  ：不做任何拦截。本机实测 open.spotify.com:443 不可达，
 *                  因此这是最忠实的目标环境复现（静默挂起）。
 *   mode = block ：Network.setBlockedURLs 阻断 spotify 域名，模拟快速失败
 *                  （net::ERR_BLOCKED_BY_CLIENT）。
 *   mode = hang  ：Fetch 拦截并「永不 continue」，模拟 DNS 污染 / TCP 黑洞
 *                  造成的请求静默挂起（确定性复现，不依赖本机网络状态）。
 *
 * 每个模式都记录：iframe 的 load/error 事件时间线、spotify 网络请求与失败原因、
 * 展开后 1.5s 与 9s 的 DOM 状态（iframe / 降级面板 / 高度 / 链接）、控制台错误、截图。
 *
 * 用法：node verify-spotify-fallback-v2.cjs <debugPort> <baseUrl> <outDir> [modes]
 *   modes 逗号分隔，默认 "real,block,hang"
 * 退出码：所有模式断言通过 = 0，否则 = 1；脚本自身异常 = 3/4。
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.argv[2] || 9222);
const BASE = process.argv[3] || 'http://127.0.0.1:3211';
const OUT = process.argv[4] || os.tmpdir();
const MODES = (process.argv[5] || 'real,block,hang').split(',').map((s) => s.trim()).filter(Boolean);
const PROFILE = path.join(process.env.TEMP || os.tmpdir(), 'chrome-tmp-embedtest-v2');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Users\\86185\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

/** Embed 降级判定阈值（与 components/MusicModule.tsx 的 EMBED_TIMEOUT_MS 对齐） */
const EXPECTED_FALLBACK_MS = 6000;
/** 展开后多久检查「未降级」中间态 */
const BEFORE_CHECK_MS = 1500;
/** 展开后多久检查「最终态」，留足超时余量 */
const AFTER_CHECK_MS = 9000;

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

/** 最小 CDP 客户端：发命令 + 订阅事件 */
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
  send(method, params = {}, timeoutMs = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      // 本环境曾出现 Page.captureScreenshot 永久不返回：所有命令都必须带超时，否则脚本会静默挂死
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 命令超时（${timeoutMs}ms）：${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(file) {
    // 本环境的 Chrome 实例上 Page.captureScreenshot 可能永久不返回（已实测超时），
    // 截图属辅助证据：失败时返回说明字符串，不阻断断言流程（视觉证据由 Playwright 侧补齐）
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }, 8000);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    } catch (err) {
      return `unavailable: ${err.message}`;
    }
  }
}

/** 元素滚到视口中央并返回中心坐标（附带命中测试，避免点到被覆盖的元素） */
const CENTER_OF = (selector) => `(() => {
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
})()`;

/** 在页面里安装 iframe 事件插桩：捕获 iframe 的增删与 load/error 时间线 */
const INSTALL_PROBE = `(() => {
  window.__embedlog = { events: [], console: [] };
  if (window.__embedProbeInstalled) return 'already';
  window.__embedProbeInstalled = true;
  const stamp = () => Math.round(performance.now());
  const attach = (n) => {
    n.addEventListener('load', () => window.__embedlog.events.push({ t: stamp(), type: 'load', src: n.getAttribute('src') }));
    n.addEventListener('error', () => window.__embedlog.events.push({ t: stamp(), type: 'error', src: n.getAttribute('src') }));
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n && n.tagName === 'IFRAME') {
          window.__embedlog.events.push({ t: stamp(), type: 'added', src: n.getAttribute('src') });
          attach(n);
        }
      }
      for (const n of m.removedNodes) {
        if (n && n.tagName === 'IFRAME') {
          window.__embedlog.events.push({ t: stamp(), type: 'removed', src: n.getAttribute('src') });
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  return 'installed';
})()`;

/** 读取展开态 DOM 快照 */
const SNAPSHOT = `(() => {
  const iframe = document.querySelector('.mm-embed iframe');
  const fb = document.querySelector('.mm-embed-fallback');
  const links = fb ? [...fb.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') })) : [];
  return {
    embedWrapper: !!document.querySelector('.mm-embed'),
    iframePresent: !!iframe,
    iframeSrc: iframe ? iframe.getAttribute('src') : null,
    fallbackPresent: !!fb,
    fallbackHeight: fb ? Math.round(fb.getBoundingClientRect().height) : null,
    fallbackText: fb ? fb.textContent.trim() : null,
    links,
    expandedOpen: !!document.querySelector('.mm-expand.open'),
  };
})()`;

(async () => {
  const results = {
    port: PORT,
    base: BASE,
    startedAt: new Date().toISOString(),
    thresholds: { expectedFallbackMs: EXPECTED_FALLBACK_MS, beforeCheckMs: BEFORE_CHECK_MS, afterCheckMs: AFTER_CHECK_MS },
    modes: [],
  };
  fs.mkdirSync(OUT, { recursive: true });
  const reportPath = path.join(OUT, 'verify-spotify-fallback-v2.json');
  const writeReport = () => {
    try {
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    } catch (e) {
      console.error('报告写入失败:', e.message);
    }
  };
  const log = (...a) => console.log(...a);

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
  const killChrome = () => {
    // 只结束本次启动的进程树（按 PID + /T），避免误伤用户已开的 Chrome
    spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  };

  let wsRef = null;
  let current = null; // 当前模式的采集容器

  try {
    const version = await waitForDebugger(30000);
    log(`[chrome] ${version.Browser}`);

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
    await cdp.send('Log.enable');

    // ── 网络/控制台事件统一采集，按模式切换 current 容器 ──
    const spotifyRe = /open\.spotify\.com|spotifycdn\.com|scdn\.co/;
    cdp.on('Network.requestWillBeSent', (p) => {
      if (current && spotifyRe.test(p.request.url)) {
        current.network.push({ kind: 'request', url: p.request.url, type: p.type || null });
      }
    });
    cdp.on('Network.responseReceived', (p) => {
      if (current && spotifyRe.test(p.response.url)) {
        current.network.push({ kind: 'response', url: p.response.url, status: p.response.status });
      }
    });
    cdp.on('Network.loadingFailed', (p) => {
      if (!current) return;
      current.network.push({ kind: 'failed', requestId: p.requestId, errorText: p.errorText, blockedReason: p.blockedReason || null, type: p.type || null });
    });
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (current && p.type === 'error') {
        current.consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
      }
    });
    cdp.on('Log.entryAdded', (p) => {
      if (current && p.entry && p.entry.level === 'error') {
        current.consoleErrors.push(String(p.entry.text || '').slice(0, 300));
      }
    });
    // Fetch 拦截：hang 模式只记录、永不 continue，制造确定性静默挂起
    cdp.on('Fetch.requestPaused', (p) => {
      if (current) current.network.push({ kind: 'paused-not-resumed', url: p.request.url });
    });

    const moveMouse = (x, y) =>
      cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
    const realClick = async (x, y) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    };

    /** 按模式设置拦截 */
    async function armMode(mode) {
      if (mode === 'block') {
        await cdp.send('Network.setBlockedURLs', { urls: ['*://open.spotify.com/*', '*://*.spotifycdn.com/*', '*://*.scdn.co/*'] });
      } else if (mode === 'hang') {
        await cdp.send('Fetch.enable', {
          patterns: [
            { urlPattern: '*open.spotify.com*', requestStage: 'Request' },
            { urlPattern: '*spotifycdn.com*', requestStage: 'Request' },
          ],
        });
      }
    }
    async function disarmMode(mode) {
      if (mode === 'block') await cdp.send('Network.setBlockedURLs', { urls: [] });
      if (mode === 'hang') await cdp.send('Fetch.disable');
    }

    for (const mode of MODES) {
      const rec = {
        mode,
        network: [],
        consoleErrors: [],
        steps: {},
        assertions: {},
        shots: {},
        startedAt: new Date().toISOString(),
      };
      current = rec;
      log(`\n===== mode=${mode} =====`);

      try {
        await armMode(mode);
        rec.steps.armed = mode === 'real' ? 'no-interception' : mode;

        await cdp.send('Page.navigate', { url: `${BASE}/` });
        await sleep(4500);
        rec.steps.probe = await cdp.eval(INSTALL_PROBE);

        // 曲目数据是否就绪（未授权会让后续断言失去意义，必须显式暴露）
        const pre = await cdp.eval(`(() => ({
          musicRow: !!document.querySelector('li[data-viewer="music"]'),
          errorText: (document.querySelector('.mm-error')?.textContent || '').trim() || null,
        }))()`);
        rec.steps.pre = pre;

        const liCenter = await cdp.eval(CENTER_OF('li[data-viewer="music"]'));
        rec.steps.locateMusicRow = liCenter;
        if (!liCenter) throw new Error('li[data-viewer=music] 未找到');
        await moveMouse(liCenter.x, liCenter.y);
        await sleep(2000);
        await moveMouse(liCenter.x, liCenter.y + 2); // 触发新一轮 mouseover
        await sleep(1500);

        const viewerState = await cdp.eval(`(() => {
          const v = document.querySelector('#musicViewer');
          return { viewerPresent: !!v, trackCount: document.querySelectorAll('.mm-track-item').length };
        })()`);
        rec.steps.musicViewer = viewerState;
        if (!viewerState.viewerPresent || viewerState.trackCount === 0) {
          rec.steps.ABORT = '音乐面板未打开或曲目为空，本模式断言无法进行';
          await disarmMode(mode);
          results.modes.push(rec);
          writeReport();
          continue;
        }

        const trackCenter = await cdp.eval(CENTER_OF('.mm-track-item'));
        rec.steps.locateTrack = trackCenter;
        await moveMouse(trackCenter.x, trackCenter.y);
        await sleep(300);
        const t0 = Date.now();
        await realClick(trackCenter.x, trackCenter.y);
        rec.steps.expandClickedAt = new Date(t0).toISOString();

        // 轮询实测降级延迟，并在 t+1.5s 取中间态快照
        let degradeAtMs = null;
        let before = null;
        while (Date.now() - t0 < AFTER_CHECK_MS) {
          const seen = await cdp.eval('!!document.querySelector(".mm-embed-fallback")');
          const elapsed = Date.now() - t0;
          if (degradeAtMs === null && seen) degradeAtMs = elapsed;
          if (!before && elapsed >= BEFORE_CHECK_MS) {
            before = await cdp.eval(SNAPSHOT);
            before.elapsedMs = Date.now() - t0;
          }
          if (before && degradeAtMs !== null) break;
          await sleep(100);
        }
        if (!before) {
          before = await cdp.eval(SNAPSHOT);
          before.elapsedMs = Date.now() - t0;
        }
        rec.before = before;
        rec.degradeAtMs = degradeAtMs;
        log(`  t+${rec.before.elapsedMs}ms  ${JSON.stringify({ iframe: rec.before.iframePresent, fallback: rec.before.fallbackPresent })}`);
        rec.shots.before = await cdp.shot(path.join(OUT, `v2-${mode}-t1500ms.jpg`));

        const remain = AFTER_CHECK_MS - (Date.now() - t0);
        if (remain > 0) await sleep(remain);
        rec.after = await cdp.eval(SNAPSHOT);
        rec.after.elapsedMs = Date.now() - t0;
        rec.events = await cdp.eval('window.__embedlog ? window.__embedlog.events : []');
        rec.shots.after = await cdp.shot(path.join(OUT, `v2-${mode}-t9000ms.jpg`));
        const netSummary = {
          requests: rec.network.filter((n) => n.kind === 'request').length,
          responseStatuses: [...new Set(rec.network.filter((n) => n.kind === 'response').map((n) => n.status))],
          failures: [...new Set(rec.network.filter((n) => n.kind === 'failed').map((n) => n.errorText))],
        };
        rec.networkSummary = netSummary;
        log(`  降级延迟: ${rec.degradeAtMs}ms`);
        log(`  t+${rec.after.elapsedMs}ms  ${JSON.stringify({ iframe: rec.after.iframePresent, fallback: rec.after.fallbackPresent, h: rec.after.fallbackHeight })}`);
        log(`  iframe事件: ${JSON.stringify(rec.events)}`);
        log(`  spotify 网络: ${JSON.stringify(netSummary)}`);

        // CDP 阻断 / Fetch 暂停属于「快速失败」：请求立刻被拒，立即降级才是期望行为；
        // 只有真实网络的静默挂起（mode=real）才应当走到 6s 期限。
        const fastFail = mode !== 'real';
        rec.assertions = {
          '点击后 embed 容器已挂载': rec.before.embedWrapper === true,
          '降级延迟符合该失败模式': fastFail
            ? rec.degradeAtMs !== null && rec.degradeAtMs <= 2500
            : rec.degradeAtMs !== null && rec.degradeAtMs >= 5000 && rec.degradeAtMs <= 9000,
          '最终降级为网易云入口': rec.after.fallbackPresent === true,
          '降级后 iframe 已卸载': rec.after.iframePresent === false,
          '降级面板高度与 embed 对齐（152±4px，含 1px 边框）': Math.abs(rec.after.fallbackHeight - 152) <= 4,
          '降级含网易云搜索链接': rec.after.links.some((l) => (l.href || '').includes('music.163.com/#/search/m/')),
          '降级含 Spotify 直链': rec.after.links.some((l) => (l.href || '').includes('open.spotify.com/track/')),
          '控制台无 error': rec.consoleErrors.length === 0,
        };
        if (!fastFail) {
          // 静默挂起期间不得提前降级（此时 iframe 仍在加载，降级会造成误伤）
          rec.assertions['静默挂起期间未提前降级'] =
            rec.before.fallbackPresent === false && rec.before.iframePresent === true;
        }
        rec.passed = Object.values(rec.assertions).every((v) => v === true);
        log(`  模式结果: ${rec.passed ? 'PASS' : 'FAIL'}`);
      } catch (err) {
        rec.error = String((err && err.message) || err);
        log(`  模式异常: ${rec.error}`);
        rec.passed = false;
        try {
          await disarmMode(mode);
        } catch {
          /* 忽略 */
        }
      }

      results.modes.push(rec);
      writeReport();
      current = null;
    }

    results.passed = results.modes.length > 0 && results.modes.every((m) => m.passed === true);
    results.finishedAt = new Date().toISOString();
    writeReport();

    log('\n===== 汇总 =====');
    for (const m of results.modes) {
      log(`  ${m.passed ? 'PASS' : 'FAIL'}  mode=${m.mode}`);
      for (const [k, v] of Object.entries(m.assertions || {})) log(`      ${v ? 'PASS' : 'FAIL'}  ${k}`);
      if (m.error) log(`      ERROR ${m.error}`);
    }
    log(`\n总体: ${results.passed ? 'PASS' : 'FAIL'}   报告: ${reportPath}`);

    try {
      ws.close();
    } catch {
      /* 忽略 */
    }
    killChrome();
    await sleep(400);
    process.exit(results.passed ? 0 : 1);
  } catch (err) {
    console.error('脚本异常:', (err && err.stack) || err);
    results.fatal = String((err && err.message) || err);
    writeReport();
    try {
      wsRef?.close();
    } catch {
      /* 忽略 */
    }
    killChrome();
    process.exit(3);
  }
})();
