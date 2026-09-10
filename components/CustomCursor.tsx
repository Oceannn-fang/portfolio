'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import './CustomCursor.css';

/**
 * 自定义光标 — 全局覆盖层，mix-blend-mode: difference 反色
 * 移动端/窄屏自动隐藏
 */
export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 窄屏/触摸设备降级：不显示自定义光标
    const narrowQuery = window.matchMedia('(max-aspect-ratio: 16/12)');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (narrowQuery.matches || isTouch) return;

    setIsVisible(true);
    // 等 DOM 渲染出光标元素后再初始化 GSAP
    const raf = requestAnimationFrame(() => {
      const cursor = cursorRef.current;
      const dot = dotRef.current;
      if (!cursor || !dot) return;

      // 隐藏默认光标
      document.documentElement.classList.add('custom-cursor-active');

      // 圆环慢速跟随，圆点快速跟随，形成拖尾层次感
      const xTo = gsap.quickTo(cursor, 'x', { duration: 0.3, ease: 'power3.out' });
      const yTo = gsap.quickTo(cursor, 'y', { duration: 0.3, ease: 'power3.out' });
      const dotXTo = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power2.out' });
      const dotYTo = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power2.out' });

      const onMove = (e: MouseEvent) => {
        xTo(e.clientX);
        yTo(e.clientY);
        dotXTo(e.clientX);
        dotYTo(e.clientY);
      };

      const interactiveSelectors = 'a, button, [data-cursor="hover"], .row, input, textarea, select';

      // 事件委托：兼容 MusicModule / PlaylistModule 等动态挂载的交互元素
      const onOver = (e: MouseEvent) => {
        const target = (e.target as Element | null)?.closest(interactiveSelectors);
        setIsHovering(Boolean(target));
      };
      const onOut = (e: MouseEvent) => {
        const to = (e as MouseEvent).relatedTarget as Element | null;
        // 移入另一个交互元素时保持放大状态
        setIsHovering(Boolean(to?.closest?.(interactiveSelectors)));
      };
      // 鼠标离开窗口时收起
      const onLeaveWindow = () => setIsHovering(false);

      document.addEventListener('mouseover', onOver);
      document.addEventListener('mouseout', onOut);
      document.addEventListener('mouseleave', onLeaveWindow);
      window.addEventListener('mousemove', onMove);

      cleanupRef.current = () => {
        window.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseover', onOver);
        document.removeEventListener('mouseout', onOut);
        document.removeEventListener('mouseleave', onLeaveWindow);
        document.documentElement.classList.remove('custom-cursor-active');
      };
    });

    return () => {
      cancelAnimationFrame(raf);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <div ref={cursorRef} className={`cc-ring${isHovering ? ' cc-ring-hover' : ''}`} />
      <div ref={dotRef} className="cc-dot" />
    </>
  );
}
