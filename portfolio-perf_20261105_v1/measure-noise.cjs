/**
 * 噪点层性能与画质实测（Playwright + 真 Chromium）
 *
 * 目的：验证「噪点帧缓存」改造后的空闲态帧率，以及噪点密度统计是否与改造前同量级。
 * 用法：node portfolio-perf_20261105_v1/measure-noise.cjs [url] [label]
 */
const PW = 'C:/Users/86185/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core';
const { chromium } = require(PW);

const URL = process.argv[2] || 'http://127.0.0.1:3212/';
const LABEL = process.argv[3] || 'noise';

/** 采样 rAF 帧间隔，返回帧率与掉帧分布 */
const sampleFps = async (page, ms) => {
  return page.evaluate(async (duration) => {
    const frames = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const start = performance.now();
      function loop(t) {
        frames.push(t - last);
        last = t;
        if (t - start < duration) requestAnimationFrame(loop);
        else resolve();
      }
      requestAnimationFrame(loop);
    });
    const s = frames.slice(1).sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    return {
      fps: +(1000 / avg).toFixed(1),
      avgMs: +avg.toFixed(2),
      p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2),
      worstMs: +s[s.length - 1].toFixed(2),
      over32: s.filter((x) => x > 32).length,
      total: s.length,
    };
  }, ms);
};

/** 读噪点 canvas 的像素统计：不透明像素占比 = 当前密度档位 */
const sampleNoise = async (page, times, gapMs) => {
  return page.evaluate(
    async ({ count, gap }) => {
      const c = document.querySelector('canvas.noise-overlay');
      if (!c) return { err: 'no noise canvas' };
      const ctx = c.getContext('2d');
      const stat = () => {
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let opaque = 0;
        let sum = 0;
        let n = 0;
        let min = 255;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 0) {
            opaque++;
            const v = d[i];
            sum += v;
            n++;
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        return {
          frac: +(opaque / (d.length / 4)).toFixed(3),
          mean: n ? +(sum / n).toFixed(1) : 0,
          min,
          max,
        };
      };
      const out = [];
      for (let i = 0; i < count; i++) {
        out.push(stat());
        if (i < count - 1) await new Promise((r) => setTimeout(r, gap));
      }
      return { w: c.width, h: c.height, opacity: c.style.opacity, samples: out };
    },
    { count: times, gap: gapMs }
  );
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:/Users/86185/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: [
      '--no-first-run',
      '--window-size=1460,980',
      // Windows 上窗口被遮挡时 Chromium 会把页面判为 hidden，rAF 被降到 1fps，
      // 噪点循环也会因 document.hidden 直接停摆——这三点必须关掉才测得出真实帧率
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-features=Translate,CalculateNativeWinOcclusion',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const result = { label: LABEL, url: URL };

  await page.goto(URL, { waitUntil: 'load' });
  await page.bringToFront();
  await page.waitForTimeout(2500);
  result.visibility = await page.evaluate(() => document.visibilityState);

  result.noise = await sampleNoise(page, 10, 250);
  result.fps1x = await sampleFps(page, 3000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(800);
  result.fps4x = await sampleFps(page, 5000);

  await page.screenshot({ path: `portfolio-perf_20261105_v1/shot-${LABEL}-1440x900.png` });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
