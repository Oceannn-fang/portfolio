/** 线上（部署版，改动前代码）同视口截图，用于与本地改动后做布局对照 */
const PW = 'C:/Users/86185/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core';
const { chromium } = require(PW);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/86185/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: ['--no-first-run'], proxy: { server: 'http://127.0.0.1:7890' },
  });
  for (const vp of [{ name: '1440x900', width: 1440, height: 900 }, { name: '390x844', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('https://oceanfolio.vercel.app/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `portfolio-perf_20261105_v1/shot-live-${vp.name}.png` });
    await page.close();
  }
  await browser.close();
  console.log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
