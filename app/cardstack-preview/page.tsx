'use client';

/**
 * ThreeDCardStack 的开发期预览 + 自动诊断页。
 * - 仅在 development 下渲染，生产构建为空白页，不影响正式站点；
 * - ?mode=panel|full &w=1180&h=620 &scroll=6（合成滚轮次数）
 * - 诊断结果写入 <pre id="diag">，可用 chrome --dump-dom 读取
 */

import { useEffect, useState } from 'react';
import ThreeDCardStack from '@/components/ThreeDCardStack';

type Cfg = { mode: 'panel' | 'full'; w: number; h: number; scroll: number };

/* 解析 computed transform，确认只有位移与等比缩放，没有 rotate / skew */
function inspectMatrix(transform: string) {
  const nums = transform
    .replace(/matrix3?d?\(|\)/g, '')
    .split(',')
    .map((n) => Number(n.trim()));
  if (transform.startsWith('matrix3d')) {
    const [a, b, c, , e, f, g, , i, j, k, , m, n, o] = nums;
    // 旋转 / 切变项：b c e g i j（a f k 是三个轴的缩放，不算）
    const shear = Math.max(Math.abs(b), Math.abs(c), Math.abs(e), Math.abs(g), Math.abs(i), Math.abs(j));
    return { sx: a, sy: f, sz: k, x: m, y: n, z: o, shear, uniform: Math.abs(a - f) < 1e-4 };
  }
  const [a, b, c, d, m, n] = nums;
  return { sx: a, sy: d, sz: 1, x: m, y: n, z: 0, shear: Math.max(Math.abs(b), Math.abs(c)), uniform: Math.abs(a - d) < 1e-4 };
}

async function collect(cfg: Cfg, phase: string) {
  const lines: string[] = [`===== ${phase} =====`];
  const root = document.querySelector('.tcs-root') as HTMLElement | null;
  if (!root) return ['NO ROOT'];

  const cs = getComputedStyle(root);
  lines.push(
    `vars: card-w=${cs.getPropertyValue('--card-w').trim()} card-h=${cs.getPropertyValue(
      '--card-h'
    ).trim()} u=${cs.getPropertyValue('--u').trim()} persp=${cs.getPropertyValue('--persp').trim()} size=${
      root.dataset.size
    } vel=${cs.getPropertyValue('--vel').trim()}`
  );
  lines.push(
    `panel: ${root.clientWidth}x${root.clientHeight} overflowX=${root.scrollWidth > root.clientWidth + 1} overflowY=${
      root.scrollHeight > root.clientHeight + 1
    }`
  );

  const cards = Array.from(root.querySelectorAll('.tcs-card')) as HTMLElement[];
  const stage = root.querySelector('.tcs-stage') as HTMLElement;
  const stageRect = stage.getBoundingClientRect();
  const cx = stageRect.left + stageRect.width / 2;
  const cy = stageRect.top + stageRect.height / 2;

  const rows = cards.map((el, i) => {
    const st = getComputedStyle(el);
    const m = inspectMatrix(st.transform);
    const r = el.getBoundingClientRect();
    return {
      i,
      no: (el.querySelector('.tcs-shot-num') as HTMLElement)?.textContent ?? '?',
      title: (el.querySelector('.tcs-title') as HTMLElement)?.textContent ?? '?',
      x: Number((r.left + r.width / 2 - cx).toFixed(1)),
      y: Number((r.top + r.height / 2 - cy).toFixed(1)),
      w: Number(r.width.toFixed(1)),
      scale: Number(m.sx.toFixed(4)),
      z: Number(m.z.toFixed(1)),
      shear: Number(m.shear.toFixed(6)),
      uniform: m.uniform,
      opacity: Number(Number(st.opacity).toFixed(3)),
      filter: st.filter,
      zIndex: st.zIndex,
      vis: st.visibility,
      center: el.dataset.center,
      accent: (el.querySelector('.tcs-ver') as HTMLElement)
        ? getComputedStyle(el).getPropertyValue('--accent').trim()
        : '',
    };
  });

  const visible = rows.filter((r) => r.vis === 'visible');
  lines.push(`cards: total=${cards.length} visible=${visible.length}`);
  lines.push(`no rotate/skew: ${visible.every((r) => r.shear < 1e-5 && r.uniform)}`);
  const centered = visible.reduce((a, b) => (Math.abs(a.x) <= Math.abs(b.x) ? a : b));
  lines.push(
    `center card: #${centered.no} ${centered.title} x=${centered.x} scale=${centered.scale} z=${centered.z} brightness=${centered.filter}`
  );
  // 距离越远 → 越小、越暗、越靠后
  const monotonic = visible.every((r) => {
    const dSelf = Math.abs(r.x);
    return visible.every((o) => (Math.abs(o.x) > dSelf + 1 ? o.scale < r.scale && o.z < r.z : true));
  });
  lines.push(`depth monotonic (farther = smaller + deeper): ${monotonic}`);
  const cardW = parseFloat(cs.getPropertyValue('--card-w')) || 1;
  const spacing = cardW * 0.72;
  const nearest = visible.filter((r) => Math.abs(r.x) > 1).sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
  lines.push(`vertical drift (should be 0 for every card): maxAbsY=${Math.max(...visible.map((r) => Math.abs(r.y))).toFixed(2)}`);
  lines.push(
    `overlap: spacing=${spacing.toFixed(1)} nearestCentreDistance=${nearest ? nearest.x : '?'} overlapping=${
      nearest ? Math.abs(nearest.x) < cardW : false
    }`
  );
  for (const r of visible.sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).slice(0, 7)) {
    lines.push(
      `  slot${String(r.i).padStart(2, '0')} #${r.no} x=${String(r.x).padStart(8)} w=${r.w} scale=${r.scale} z=${r.z} op=${r.opacity} ${r.filter} zi=${r.zIndex} center=${r.center}`
    );
  }

  // 图片是否真的加载成功（卡片用 background-image，避开 #viewer img{display:none}）
  const urls = Array.from(
    new Set(
      cards.map((el) => {
        const shot = el.querySelector('.tcs-shot') as HTMLElement;
        const bg = getComputedStyle(shot).backgroundImage;
        const match = bg.match(/url\("?(.*?)"?\)/);
        return match ? match[1] : '';
      })
    )
  ).filter(Boolean);
  const loaded = await Promise.all(
    urls.map(
      (url) =>
        new Promise<string>((resolve) => {
          const im = new Image();
          im.onload = () => resolve(`ok ${im.naturalWidth}x${im.naturalHeight}`);
          im.onerror = () => resolve('FAIL');
          im.src = url;
        })
    )
  );
  const failed = urls.filter((_, k) => loaded[k] === 'FAIL');
  lines.push(`images: unique=${urls.length} failed=${failed.length} ${failed.join(' | ')}`);

  // 字体
  const fontFams = ['TCS Ellograph Demi', 'TCS Ellograph Light', 'TCS Quincy Light', 'TCS Quincy Italic'];
  lines.push(
    `fonts: ${fontFams
      .map((f) => `${f.replace('TCS ', '')}=${document.fonts.check(`16px "${f}"`) ? 'ok' : 'MISSING'}`)
      .join(' ')}`
  );

  // 信息区是否溢出（小面板降级是否生效）
  const meta = root.querySelector('.tcs-card.is-center .tcs-meta') as HTMLElement | null;
  if (meta) {
    lines.push(
      `meta fit: client=${meta.clientHeight} scroll=${meta.scrollHeight} overflow=${meta.scrollHeight > meta.clientHeight + 1}`
    );
  }

  // HUD
  const hud = root.querySelector('.tcs-hud') as HTMLElement;
  const readout = root.querySelector('.tcs-readout') as HTMLElement;
  const num = root.querySelector('.tcs-readout-num b') as HTMLElement;
  const title = root.querySelector('.tcs-readout-title') as HTMLElement;
  const hudRect = hud.getBoundingClientRect();
  const roRect = readout.getBoundingClientRect();
  lines.push(
    `hud: readout="${num?.textContent} ${title?.textContent}" at(${Math.round(roRect.left - hudRect.left)},${Math.round(
      roRect.bottom - hudRect.top
    )}) inside=${roRect.left >= root.getBoundingClientRect().left - 1}`
  );
  lines.push(`hud above cards: ${getComputedStyle(hud).zIndex} vs stage ${getComputedStyle(stage).zIndex}`);
  const rail = root.querySelector('.tcs-rail') as HTMLElement;
  lines.push(`rail bgPosX=${getComputedStyle(rail).backgroundPositionX}`);
  lines.push(`cfg=${JSON.stringify(cfg)}`);
  return lines;
}

export default function CardStackPreviewPage() {
  const [dev, setDev] = useState(false);
  const [cfg, setCfg] = useState<Cfg>({ mode: 'panel', w: 1180, h: 620, scroll: 0 });
  const [diag, setDiag] = useState<string>('running...');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    setDev(true);

    const q = new URLSearchParams(window.location.search);
    const next: Cfg = {
      mode: q.get('mode') === 'full' ? 'full' : 'panel',
      w: Number(q.get('w')) || 1180,
      h: Number(q.get('h')) || 620,
      scroll: Number(q.get('scroll')) || 0,
    };
    setCfg(next);

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 2200));
      const before = await collect(next, 'REST');
      let after: string[] = [];
      if (next.scroll > 0) {
        const root = document.querySelector('.tcs-root');
        if (root) {
          for (let i = 0; i < next.scroll; i++) {
            root.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
          }
        }
        await new Promise((r) => setTimeout(r, 6000));
        after = await collect(next, `AFTER ${next.scroll} WHEEL NOTCHES (deltaY=100)`);
      }
      if (!cancelled) {
        document.title = 'DIAG-DONE';
        setDiag([...before, ...after].join('\n'));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dev) return null;

  const panel = (
    <div
      style={{
        position: 'relative',
        width: cfg.mode === 'full' ? '100%' : `${cfg.w}px`,
        height: cfg.mode === 'full' ? '100%' : `${cfg.h}px`,
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <ThreeDCardStack />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0c11', display: 'grid', placeItems: 'center' }}>
      {panel}
      <pre
        id="diag"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          margin: 0,
          padding: 4,
          fontSize: 10,
          color: '#0f0',
          background: '#000',
          whiteSpace: 'pre-wrap',
          zIndex: 99999,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        {diag}
      </pre>
    </div>
  );
}
