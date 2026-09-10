'use client';

import { useEffect, useRef, useState } from 'react';
import './SkillMarquee.css';

// 默认技能标签（未传入 skills 时兜底）
const defaultSkills = [
  'Creative Development', 'WebGL', 'Motion Design', 'React',
  'TypeScript', 'Three.js', 'GSAP', 'UI Animation',
  'Next.js', 'Shader Programming', 'Figma', 'Blender',
];

interface Props {
  skills?: string[];
  speed?: number; // 基础滚动周期（秒），默认 30
}

export default function SkillMarquee({ skills, speed = 30 }: Props) {
  const items = skills && skills.length > 0 ? skills : defaultSkills;
  const rootRef = useRef<HTMLElement>(null);
  const rowLeftRef = useRef<HTMLDivElement>(null);
  // 内容重复份数：保证单份宽度 ≥ 视口，-50% 循环点才不会露白
  const [repeat, setRepeat] = useState(2);

  // 挂载后测量单份内容宽度，窄视口下自动增加份数
  useEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      const row = rowLeftRef.current;
      if (!root || !row) return;
      const setWidth = row.scrollWidth / repeat; // 当前单份宽度
      // 向上取偶数份：CSS 兜底动画的 -50% 循环点必须落在集合边界才无缝
      const needed = Math.max(2, Math.ceil((root.clientWidth * 2) / Math.max(setWidth, 1)));
      setRepeat((prev) => (needed > prev ? needed + (needed % 2) : prev));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [repeat]);

  // 内容重复 repeat 份以实现无缝衔接（滚动 -50% 时正好回到起点）
  const repeated = Array.from({ length: repeat }, (_, group) =>
    items.map((skill, index) => ({ skill, key: `${group}-${index}` }))
  ).flat();

  // 滚动速度联动：rAF 累积位移，页面滚动越快跑马灯越快
  // 相比直接改 animation-duration，累积位移不会在变速瞬间产生跳变
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rowLeft = root.querySelector<HTMLElement>('.sm-row-left');
    const rowRight = root.querySelector<HTMLElement>('.sm-row-right');
    if (!rowLeft || !rowRight) return;

    let offset = 0; // 已累积位移（px）
    let lastY = window.scrollY;
    let lastScrollTime = performance.now();
    let lastTime = performance.now();
    let scrollBoost = 0; // 滚动带来的瞬时加速，随时间指数衰减
    let hovered = false;
    let raf = 0;

    const onScroll = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = Math.max(now - lastScrollTime, 1);
      lastY = window.scrollY;
      lastScrollTime = now;
      // 滚动速度 px/ms 换算为加速倍率，封顶 3 倍
      scrollBoost = Math.min(scrollBoost + (dy / dt) * 0.6, 3);
    };

    const onEnter = () => { hovered = true; };
    const onLeave = () => { hovered = false; };

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      // hover 暂停，但衰减逻辑跳过
      if (!hovered) {
        const width = rowLeft.scrollWidth / 2; // 一半内容的宽度（循环周期）
        if (width > 0) {
          // 基础速度：一个周期滚完单份内容；boost 让速度最多提升到 4 倍
          const base = width / speed;
          offset = (offset + base * (1 + scrollBoost) * dt) % width;
        }
        scrollBoost *= Math.exp(-dt * 2.5); // 指数衰减
        rowLeft.style.transform = `translateX(${-offset}px)`;
        rowRight.style.transform = `translateX(${offset - rowRight.scrollWidth / 2}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    // JS 接管后停用 CSS 动画，避免 transform 冲突
    rowLeft.classList.add('sm-js-driven');
    rowRight.classList.add('sm-js-driven');
    window.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('mouseenter', onEnter);
    root.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      root.removeEventListener('mouseenter', onEnter);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, [speed]);

  return (
    <section className="sm-root" ref={rootRef} aria-label="Skills marquee">
      <div className="sm-viewport">
        <div
          ref={rowLeftRef}
          className="sm-row sm-row-left"
          style={{ '--sm-duration': `${speed}s` } as React.CSSProperties}
        >
          {repeated.map(({ skill, key }) => (
            <span key={`l-${key}`} className="sm-item">
              {skill}
              <span className="sm-sep" aria-hidden="true">✦</span>
            </span>
          ))}
        </div>
      </div>
      <div className="sm-viewport">
        <div
          className="sm-row sm-row-right"
          style={{ '--sm-duration': `${speed * 1.2}s` } as React.CSSProperties}
        >
          {repeated.map(({ skill, key }) => (
            <span key={`r-${key}`} className="sm-item sm-item-alt">
              {skill}
              <span className="sm-sep" aria-hidden="true">●</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
