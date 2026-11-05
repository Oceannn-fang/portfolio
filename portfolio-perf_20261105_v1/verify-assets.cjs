/**
 * 资源可用性校验：加载首页，收集所有 4xx/5xx 响应，确认移走 PNG 后展示路径无 404。
 * 用法：node portfolio-perf_20261105_v1/verify-assets.cjs [url]
 */
const PW = 'C:/Users/86185/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core';
const { chromium } = require(PW);

const URL = process.argv[2] || 'http://127.0.0.1:3212/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:/Users/86185/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: ['--no-first-run'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bad = [];
  const seen = new Set();
  page.on('response', (res) => {
    if (res.status() >= 400) bad.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => bad.push(`FAILED ${req.url()} (${req.failure()?.errorText})`));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // 逐张确认展示路径可用（web 单图 / thumb 缩略图 / 3D 封面）
  const probes = await page.evaluate(async () => {
    const list = [
      '/images/portfolio/web/carmen.webp',
      '/images/portfolio/web/vienna.webp',
      '/images/portfolio-thumbs/carmen.webp',
      '/images/portfolio-thumbs/vienna.webp',
      '/music-cover-3d/album_covers_webp/01_frank_ocean_blonde.webp',
      '/gk3-assets/img/phone-frame-2.png',
    ];
    const out = [];
    for (const p of list) {
      try {
        const r = await fetch(p, { method: 'GET' });
        out.push({ path: p, status: r.status, bytes: (await r.arrayBuffer()).byteLength });
      } catch (e) {
        out.push({ path: p, status: 'ERR', bytes: 0 });
      }
    }
    return out;
  });

  const originals = await page.evaluate(async () => {
    const r = await fetch('/images/portfolio/carmen.png');
    return { status: r.status };
  });

  console.log(JSON.stringify({ badResponses: bad, probes, originalPng: originals }, null, 2));
  await browser.close();
  if (bad.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
