/**
 * 双视口截图 + 噪点/首屏关键指标采集
 * 用法：node portfolio-perf_20261105_v1/shots.cjs [url] [prefix]
 */
const PW = 'C:/Users/86185/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core';
const { chromium } = require(PW);

const URL = process.argv[2] || 'http://127.0.0.1:3212/';
const PREFIX = process.argv[3] || 'cur';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:/Users/86185/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: ['--no-first-run', '--disable-features=Translate'],
  });

  const out = {};
  for (const vp of [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '390x844', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(2600);
    const metrics = await page.evaluate(() => {
      const c = document.querySelector('canvas.noise-overlay');
      const webgl = [...document.querySelectorAll('canvas')].find((x) => x !== c);
      return {
        noise: c ? { w: c.width, h: c.height, opacity: c.style.opacity } : null,
        webgl: webgl ? { w: webgl.clientWidth, h: webgl.clientHeight } : null,
        docH: document.documentElement.scrollHeight,
        bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    await page.screenshot({
      path: `portfolio-perf_20261105_v1/shot-${PREFIX}-${vp.name}.png`,
      fullPage: false,
    });
    out[vp.name] = metrics;
    await page.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
