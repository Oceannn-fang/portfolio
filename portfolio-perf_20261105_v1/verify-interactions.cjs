/**
 * 交互路径功能验证：hover/click 打开各 viewer，确认图片真的解码出来、无 404、无控制台报错。
 * 用法：node portfolio-perf_20261105_v1/verify-interactions.cjs [url]
 */
const PW = 'C:/Users/86185/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core';
const { chromium } = require(PW);

const URL = process.argv[2] || 'http://127.0.0.1:3212/';

const imgState = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => /\/images\/portfolio\//.test(i.currentSrc || i.src))
      .map((i) => ({
        src: (i.currentSrc || i.src).replace(location.origin, ''),
        natural: `${i.naturalWidth}x${i.naturalHeight}`,
        complete: i.complete,
        shown: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
      }))
  );

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:/Users/86185/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: ['--no-first-run'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const bad = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  });
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace('http://127.0.0.1:3212', '')}`);
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 160)));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const out = {};

  // 1) hover portfolio 行 → 左侧 viewer 打开，PortfolioModule 显示单图
  const pItem = page.locator('li[data-viewer="portfolio"]').first();
  await pItem.hover();
  await page.waitForTimeout(1500);
  out.viewerImgs = await imgState(page);
  await page.screenshot({ path: 'portfolio-perf_20261105_v1/shot-viewer-portfolio.png' });

  // 2) 点击作品名 → TiltedCard 大图浮层
  await pItem.click();
  await page.waitForTimeout(1600);
  out.overlayImgs = await imgState(page);
  await page.screenshot({ path: 'portfolio-perf_20261105_v1/shot-overlay-portfolio.png' });

  // 关闭浮层，并把指针移开：否则指针停在目标 li 上时不会再触发 mouseenter
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);

  // 3) hover music 行 → MusicModule
  await page.locator('li[data-viewer="music"]').first().hover();
  await page.waitForTimeout(2200);
  out.musicViewerPresent = await page.evaluate(() => !!document.querySelector('#musicViewer'));
  await page.screenshot({ path: 'portfolio-perf_20261105_v1/shot-viewer-music.png' });

  // 4) hover showcase 行 → AlbumShowcase（含 3D iframe 浮层入口）
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await page.locator('li[data-viewer="showcase"]').first().hover();
  await page.waitForTimeout(2200);
  out.showcaseImgs = await page.evaluate(
    () =>
      [...document.querySelectorAll('img')]
        .filter((i) => /album_covers_webp/.test(i.currentSrc || i.src))
        .slice(0, 3)
        .map((i) => ({
          src: (i.currentSrc || i.src).replace(location.origin, ''),
          natural: `${i.naturalWidth}x${i.naturalHeight}`,
        }))
  );
  await page.screenshot({ path: 'portfolio-perf_20261105_v1/shot-viewer-showcase.png' });

  out.badResponses = bad;
  out.consoleErrors = consoleErrors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  if (bad.length || consoleErrors.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
