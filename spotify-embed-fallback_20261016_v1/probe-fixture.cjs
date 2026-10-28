/**
 * Embed 可达性探测原语的浏览器内验证夹具（本次验证专用，不属于产品代码）
 *
 * 目的：components/MusicModule.tsx 的 probeEmbedReachable() 有两条分支，
 * 「不可达 → 降级」可以在真实站点上端到端验证，但「可达 → 保留播放器」这条
 * 分支在本机无法用 open.spotify.com 触发（本机到该域名本就不可达）。
 * 因此用一个本地夹具在真实浏览器里分别喂给它三种目标：
 *
 *   spotify : https://open.spotify.com/favicon.ico  → 本机/目标环境均不可达，期望 false
 *   local   : http://127.0.0.1:3398/local-ok.txt    → 可达，期望 true（即「保留播放器」分支）
 *   hang    : http://127.0.0.1:3399/hang            → 只接受连接、永不响应，期望 false（走 AbortController 超时）
 *
 * 探测函数是从产品代码逐字复制的逻辑副本，仅替换了目标 URL 与超时入参；
 * 夹具只做验证，不影响产品运行时行为。
 *
 * 用法：node probe-fixture.cjs
 *   http://127.0.0.1:3398/  → 夹具页面
 */
const http = require('node:http');

const FIXTURE_PORT = 3398;
const BLACKHOLE_PORT = 3399;

const HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8" /><title>embed probe fixture</title></head>
<body>
<div id="probe-result" data-status="pending">pending</div>
<script>
  // 与 components/MusicModule.tsx 的 probeEmbedReachable 一致，仅多了一个目标 URL 入参
  const PROBE_TIMEOUT_MS = 6000;
  async function probeEmbedReachable(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      return true;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  (async () => {
    const t0 = performance.now();
    const [spotify, local, hang] = await Promise.all([
      probeEmbedReachable('https://open.spotify.com/favicon.ico', PROBE_TIMEOUT_MS),
      probeEmbedReachable('/local-ok.txt', PROBE_TIMEOUT_MS),
      probeEmbedReachable('http://127.0.0.1:${BLACKHOLE_PORT}/hang', PROBE_TIMEOUT_MS),
    ]);
    const ms = Math.round(performance.now() - t0);
    const el = document.getElementById('probe-result');
    el.dataset.status = 'done';
    el.dataset.spotify = String(spotify);
    el.dataset.local = String(local);
    el.dataset.hang = String(hang);
    el.dataset.ms = String(ms);
    el.textContent = 'spotify=' + spotify + ' local=' + local + ' hang=' + hang + ' ms=' + ms;
  })();
</script>
</body>
</html>
`;

const fixture = http.createServer((req, res) => {
  if (req.url === '/local-ok.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

// 黑洞服务：接受连接但永不响应，用于确定性地触发 AbortController 超时
const blackhole = http.createServer(() => {
  /* 故意不响应 */
});

fixture.listen(FIXTURE_PORT, '127.0.0.1', () => {
  console.log(`[fixture] http://127.0.0.1:${FIXTURE_PORT}/`);
});
blackhole.listen(BLACKHOLE_PORT, '127.0.0.1', () => {
  console.log(`[blackhole] http://127.0.0.1:${BLACKHOLE_PORT}/hang (永不响应)`);
});
