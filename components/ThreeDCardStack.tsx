'use client';

/**
 * ThreeDCardStack
 * 原版 vanilla JS「3dmotion / HORIZONTAL STACK MOTION」项目的忠实 React 移植。
 *
 * 移植要点：
 * - 视觉、动画数值、交互行为与原版逐行一致（缓动 0.08、spacing = cardWidth * 0.72、
 *   z = -distance * 90、scale = 1 - t * 0.42、focus 时 scale 1.75 / z 200 等）；
 * - 不使用 React state 驱动每帧渲染，卡片池（POOL_SIZE = 13 * 3 = 39 个 DOM 元素）
 *   与 innerHTML 复用逻辑均在 useEffect 中直接操作 DOM，与原版一致；
 * - 事件监听绑定在组件根容器上（原版绑定在 document），避免影响宿主页面；
 * - getCardWidth() 改为基于组件容器宽度而非 window.innerWidth
 *   （组件运行在 Gk3Clone viewer 面板内，不是全屏页面）。
 */

import { useEffect, useRef } from 'react';
import './ThreeDCardStack.css';

/* ------------------------------------------------------------------ */
/* 数据与常量（与原版 main.js 完全一致）                                */
/* ------------------------------------------------------------------ */

type CardData = {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  img: number;
  cls: string;
  ver: string;
};

const ACCENTS = ['#D7FF49', '#FF5F3D', '#84D7FF'];

const CARDS: CardData[] = [
  { id: 'ARC-001', title: 'NEXUS',    subtitle: 'Quantum Relay',    desc: 'Entangled signal node bridging parallel data streams.', img: 1011, cls: 'OMEGA-7',  ver: 'v2.4' },
  { id: 'ARC-002', title: 'CIPHER',   subtitle: 'Encryption Core',  desc: 'Zero-knowledge proof matrix with rotating key layers.', img: 1015, cls: 'SIGMA-3',  ver: 'v1.8' },
  { id: 'ARC-003', title: 'PHANTOM',  subtitle: 'Ghost Protocol',   desc: 'Stealth execution unit operating off-chain.', img: 1016, cls: 'DELTA-9',  ver: 'v3.1' },
  { id: 'ARC-004', title: 'VERTEX',   subtitle: 'Spatial Anchor',   desc: 'Geodesic coordinate lock for persistent world state.', img: 1018, cls: 'ALPHA-2',  ver: 'v4.0' },
  { id: 'ARC-005', title: 'ECHO',     subtitle: 'Signal Trace',     desc: 'Recursive ping module mapping latent network paths.', img: 1020, cls: 'BETA-5',   ver: 'v1.2' },
  { id: 'ARC-006', title: 'FLUX',     subtitle: 'Energy Conduit',   desc: 'High-throughput power relay with thermal damping.', img: 1022, cls: 'GAMMA-1',  ver: 'v2.9' },
  { id: 'ARC-007', title: 'VOID',     subtitle: 'Null Chamber',     desc: 'Isolated vacuum state for quantum decoherence tests.', img: 1024, cls: 'OMEGA-12', ver: 'v0.7' },
  { id: 'ARC-008', title: 'PRISM',    subtitle: 'Refraction Array', desc: 'Spectral splitter decomposing raw input into bands.', img: 1025, cls: 'THETA-4',  ver: 'v2.1' },
  { id: 'ARC-009', title: 'HELIX',    subtitle: 'Bio-Sequence',     desc: 'Self-replicating strand with mutation checkpoints.', img: 1029, cls: 'ZETA-8',   ver: 'v5.3' },
  { id: 'ARC-010', title: 'RUNE',     subtitle: 'Ancient Cipher',   desc: 'Decoded glyph block from pre-network archives.', img: 1035, cls: 'KAPPA-6',  ver: 'v1.0' },
  { id: 'ARC-011', title: 'SURGE',    subtitle: 'Power Spike',      desc: 'Transient overload recorder with fail-safe clamps.', img: 1036, cls: 'LAMBDA-1', ver: 'v3.7' },
  { id: 'ARC-012', title: 'DRIFT',    subtitle: 'Temporal Shift',   desc: 'Clock-skew logger across asynchronous domains.', img: 1039, cls: 'MU-11',    ver: 'v2.2' },
  { id: 'ARC-013', title: 'SHARD',    subtitle: 'Fragment Unit',    desc: 'Recovery shard reassembling partial state snapshots.', img: 1043, cls: 'NU-3',     ver: 'v1.5' },
];

const N = CARDS.length;
const VISIBLE_RANGE = 7;
const COPIES = 3;
const POOL_SIZE = N * COPIES;

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

export default function ThreeDCardStack() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const readoutIndexRef = useRef<HTMLDivElement | null>(null);
  const readoutTitleRef = useRef<HTMLDivElement | null>(null);
  const readoutSubRef = useRef<HTMLDivElement | null>(null);
  const noiseOverlayRef = useRef<HTMLDivElement | null>(null);
  const focusBackdropRef = useRef<HTMLDivElement | null>(null);
  const siteHeaderRef = useRef<HTMLElement | null>(null);
  const readoutElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const carousel = carouselRef.current;
    const readoutIndex = readoutIndexRef.current;
    const readoutTitle = readoutTitleRef.current;
    const readoutSub = readoutSubRef.current;
    const noiseOverlay = noiseOverlayRef.current;
    const focusBackdrop = focusBackdropRef.current;
    const siteHeader = siteHeaderRef.current;
    const readoutEl = readoutElRef.current;
    if (!root || !carousel || !readoutIndex || !readoutTitle || !readoutSub ||
        !noiseOverlay || !focusBackdrop || !siteHeader || !readoutEl) {
      return;
    }

    /* ---------------- 原版 state ---------------- */
    const state = {
      current: 0,
      target: 0,
      velocity: 0,
      focused: false,
      focusProgress: 0,
    };

    /* ---------------- 卡片池：预创建 POOL_SIZE 个 DOM 元素 ---------------- */
    const cards: HTMLDivElement[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.display = 'none';
      carousel.appendChild(el);
      cards.push(el);
    }

    /* ---------------- 噪点生成（与原版一致） ---------------- */
    const generateNoise = () => {
      const c = document.createElement('canvas');
      const s = 150;
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const img = ctx.createImageData(s, s);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      noiseOverlay.style.backgroundImage = 'url(' + c.toDataURL() + ')';
      noiseOverlay.style.backgroundRepeat = 'repeat';
    };

    /* ---------------- focus 切换（与原版一致） ---------------- */
    const toggleFocus = () => {
      state.focused = !state.focused;
      if (state.focused) {
        focusBackdrop.classList.add('is-active');
        siteHeader.classList.add('is-hidden');
        readoutEl.classList.add('is-hidden');
      } else {
        focusBackdrop.classList.remove('is-active');
        siteHeader.classList.remove('is-hidden');
        readoutEl.classList.remove('is-hidden');
      }
    };

    /* ---------------- 滚轮（绑定在根容器上，deltaY * 0.004） ---------------- */
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (state.focused) return;
      state.target += e.deltaY * 0.004;
    };

    /* ---------------- 触摸（与原版一致，含松手惯性 velocity * 8） ---------------- */
    let touchStartX = 0;
    let lastTouchX = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (state.focused) return;
      touchStartX = e.touches[0].clientX;
      lastTouchX = touchStartX;
      state.velocity = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (state.focused) return;
      const x = e.touches[0].clientX;
      const delta = lastTouchX - x;
      state.target += delta * 0.008;
      state.velocity = delta * 0.008;
      lastTouchX = x;
    };

    const onTouchEnd = () => {
      if (state.focused) return;
      state.target += state.velocity * 8;
      state.velocity = 0;
    };

    /* ---------------- 键盘（Space 切换 focus，Escape 退出，方向键步进） ---------------- */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        toggleFocus();
        return;
      }
      if (e.key === 'Escape' && state.focused) {
        e.preventDefault();
        toggleFocus();
        return;
      }
      if (state.focused) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        state.target += 1;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        state.target -= 1;
      }
    };

    /* ---------------- 点击中心卡片进入 focus / 点击背板退出 ---------------- */
    const onCarouselClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const card = target?.closest('.card') as HTMLElement | null;
      if (!card) return;
      const cardIdx = parseInt(card.dataset.cid ?? '', 10);
      const currentIdx = ((Math.round(state.current) % N) + N) % N;
      if (cardIdx === currentIdx) {
        toggleFocus();
      }
    };

    const onBackdropClick = () => {
      if (state.focused) toggleFocus();
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    root.addEventListener('keydown', onKeyDown);
    carousel.addEventListener('click', onCarouselClick);
    focusBackdrop.addEventListener('click', onBackdropClick);

    /* ---------------- 主循环（缓动 current += diff * 0.08） ---------------- */
    let rafId = 0;

    const tick = () => {
      const diff = state.target - state.current;
      state.current += diff * 0.08;
      if (Math.abs(diff) < 0.0005) {
        state.current = state.target;
      }
      const focusTarget = state.focused ? 1 : 0;
      const focusDiff = focusTarget - state.focusProgress;
      state.focusProgress += focusDiff * 0.1;
      if (Math.abs(focusDiff) < 0.001) {
        state.focusProgress = focusTarget;
      }
      render();
      rafId = requestAnimationFrame(tick);
    };

    /* ---------------- 卡片宽度：基于组件容器宽度（原版基于 window.innerWidth） ---------------- */
    const getCardWidth = () => {
      const w = root.clientWidth;
      if (w <= 480) return 160;
      if (w <= 768) return 200;
      if (w <= 1024) return 240;
      return 280;
    };

    /* ---------------- 渲染（与原版逐行一致） ---------------- */
    const render = () => {
      const cur = state.current;
      const base = Math.floor(cur);
      const frac = cur - base;
      const spacing = getCardWidth() * 0.72;
      const fp = state.focusProgress;

      for (let i = 0; i < POOL_SIZE; i++) {
        cards[i].style.display = 'none';
      }

      for (let offset = -VISIBLE_RANGE - 1; offset <= VISIBLE_RANGE + 1; offset++) {
        const pos = offset - frac;
        const distance = Math.abs(pos);
        if (distance > VISIBLE_RANGE + 1) continue;

        const poolIdx = ((base + offset) % POOL_SIZE + POOL_SIZE) % POOL_SIZE;
        const cardIdx = ((base + offset) % N + N) % N;
        const d = CARDS[cardIdx];
        const accent = ACCENTS[cardIdx % 3];
        const t = Math.min(distance / VISIBLE_RANGE, 1);

        let x = pos * spacing;
        let z = -distance * 90;
        let scale = 1 - t * 0.42;
        let opacity = 1 - t * t * 0.75;
        let bright = 1 - t * 0.4;
        let sat = 1 - t * 0.5;
        let zIdx = Math.max(0, ((VISIBLE_RANGE + 1 - distance) * 10) | 0);
        const isCenter = distance < 0.5;

        if (fp > 0.001) {
          if (isCenter) {
            const focusScale = 1.75;
            const focusZ = 200;
            scale = scale + (focusScale - scale) * fp;
            z = z + (focusZ - z) * fp;
            opacity = opacity + (1 - opacity) * fp;
            bright = bright + (1 - bright) * fp;
            sat = sat + (1 - sat) * fp;
            zIdx = 1000;
          } else {
            opacity = opacity * (1 - fp * 0.9);
            bright = bright * (1 - fp * 0.3);
          }
        }

        const el = cards[poolIdx];
        if (el.dataset.cid !== '' + cardIdx) {
          el.dataset.cid = '' + cardIdx;
          el.style.setProperty('--card-accent', accent);
          el.innerHTML =
            '<div class="card-image-wrap">' +
              '<img class="card-image" src="https://picsum.photos/id/' + d.img + '/560/480" alt="' + d.title + '" loading="lazy">' +
              '<div class="card-image-overlay"></div>' +
              '<div class="card-badge">' + d.cls + '</div>' +
              '<div class="card-ver">' + d.ver + '</div>' +
            '</div>' +
            '<div class="card-info">' +
              '<div class="card-title">' + d.title + '</div>' +
              '<div class="card-subtitle">' + d.subtitle + '</div>' +
              '<div class="card-desc">' + d.desc + '</div>' +
              '<div class="card-bottom">' +
                '<span class="card-bottom-label">ID</span>' +
                '<span class="card-bottom-val">' + d.id + '</span>' +
              '</div>' +
            '</div>';
        }

        el.style.display = '';
        el.style.transform = 'translate3d(' + x + 'px, 0px, ' + z + 'px) scale(' + scale + ')';
        el.style.opacity = String(opacity);
        el.style.filter = 'brightness(' + bright + ') saturate(' + sat + ')';
        el.style.zIndex = String(zIdx);

        if (isCenter && fp > 0.5) {
          el.classList.add('is-focused');
        } else {
          el.classList.remove('is-focused');
        }
      }

      updateReadout(cur);
    };

    /* ---------------- 底部 readout（Math.round 只出现在编号上） ---------------- */
    const updateReadout = (cur: number) => {
      const idx = ((Math.round(cur) % N) + N) % N;
      const card = CARDS[idx];
      const num = idx + 1;
      readoutIndex.textContent = (num < 10 ? '0' : '') + num;
      readoutTitle.textContent = card.title;
      readoutSub.textContent = card.subtitle;
    };

    /* ---------------- init ---------------- */
    generateNoise();
    render();
    rafId = requestAnimationFrame(tick);

    /* ---------------- 清理 ---------------- */
    return () => {
      cancelAnimationFrame(rafId);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('keydown', onKeyDown);
      carousel.removeEventListener('click', onCarouselClick);
      focusBackdrop.removeEventListener('click', onBackdropClick);
      // 卡片池是命令式创建的 DOM，卸载时清空
      for (let i = 0; i < POOL_SIZE; i++) {
        cards[i].remove();
      }
    };
  }, []);

  return (
    <div className="tdcs-root" ref={rootRef} tabIndex={0}>
      <div className="bg-grid" />
      <div className="bg-glow" />
      <div className="bg-vignette" />
      <div className="bg-noise" ref={noiseOverlayRef} />

      <header className="site-header" ref={siteHeaderRef}>
        <h1 className="header-title">HORIZONTAL STACK MOTION</h1>
        <div className="header-meta">
          <span className="meta-tag">INTERACTIVE</span>
          <span className="meta-sep">/</span>
          <span className="meta-tag">3D CARD STACK</span>
          <span className="meta-sep">/</span>
          <span className="meta-tag">2024</span>
        </div>
      </header>

      <div className="focus-backdrop" ref={focusBackdropRef} />

      <main className="carousel-wrapper">
        <div className="carousel" ref={carouselRef} />
      </main>

      <footer className="readout" ref={readoutElRef}>
        <div className="readout-index" ref={readoutIndexRef}>01</div>
        <div className="readout-info">
          <div className="readout-title" ref={readoutTitleRef}>NEXUS</div>
          <div className="readout-sub" ref={readoutSubRef}>Quantum Relay Node</div>
        </div>
      </footer>
    </div>
  );
}
