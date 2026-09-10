'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './ImageTrail.css';

interface Props {
  /** 监听哪些元素所在容器内的 hover（如 '.gk3-root' 或 '#main'） */
  containerSelector: string;
  /** 从哪个 data 属性读取缩略图 src，默认 data-trail-image */
  imageAttribute?: string;
}

/**
 * 悬停图片拖尾组件：
 * 鼠标划过带 data-trail-image 的行时，在光标位置浮现对应缩略图，
 * 图片以 quickTo 轻微滞后跟随鼠标，离开后缩小淡出。
 * 窄屏/移动端（max-aspect-ratio: 16/12）不初始化。
 */
export default function ImageTrail({ containerSelector, imageAttribute = 'data-trail-image' }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const visibleRef = useRef(false);
  const xTo = useRef<gsap.QuickToFunc | null>(null);
  const yTo = useRef<gsap.QuickToFunc | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // 窄屏/移动端禁用拖尾效果（与项目内 viewer 的窄屏判定一致）
    const narrowQuery = window.matchMedia('(max-aspect-ratio: 16/12)');
    if (narrowQuery.matches) return;

    // 初始状态：隐藏 + 缩小；居中用 xPercent/yPercent 交给 GSAP 维护，
    // 避免 CSS 的 translate(-50%,-50%) 被 quickTo 写入的 transform 覆盖
    gsap.set(img, { xPercent: -50, yPercent: -50, scale: 0.9, opacity: 0 });

    // quickTo：高频 mousemove 下复用同一补间，图片滞后跟随光标
    xTo.current = gsap.quickTo(img, 'x', { duration: 0.4, ease: 'power3.out' });
    yTo.current = gsap.quickTo(img, 'y', { duration: 0.4, ease: 'power3.out' });

    const container = document.querySelector(containerSelector);
    if (!container) return;

    const targets = Array.from(container.querySelectorAll<HTMLElement>(`[${imageAttribute}]`));
    if (targets.length === 0) return;

    // 预加载全部缩略图，避免首次 hover 时图片闪白
    targets.forEach((target) => {
      const src = target.getAttribute(imageAttribute);
      if (src) {
        const preloader = new Image();
        preloader.src = src;
      }
    });

    const onEnter = (event: Event) => {
      const target = event.currentTarget as HTMLElement;
      const src = target.getAttribute(imageAttribute);
      if (!src || !imgRef.current) return;
      // viewer 打开时不显示拖尾，避免与面板视觉冲突
      if (document.body.classList.contains('viewing')) return;
      // 先定位到当前光标，再淡入，避免从旧位置飞过来
      const me = event as MouseEvent;
      gsap.set(imgRef.current, { x: me.clientX, y: me.clientY });
      if (imgRef.current.src !== src) imgRef.current.src = src;
      visibleRef.current = true;
      gsap.to(imgRef.current, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };

    const onLeave = () => {
      if (!imgRef.current) return;
      visibleRef.current = false;
      gsap.to(imgRef.current, { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
    };

    const onMove = (event: Event) => {
      if (!visibleRef.current) return;
      const me = event as MouseEvent;
      xTo.current?.(me.clientX);
      yTo.current?.(me.clientY);
    };

    targets.forEach((target) => {
      target.addEventListener('mouseenter', onEnter);
      target.addEventListener('mouseleave', onLeave);
      target.addEventListener('mousemove', onMove);
    });

    return () => {
      targets.forEach((target) => {
        target.removeEventListener('mouseenter', onEnter);
        target.removeEventListener('mouseleave', onLeave);
        target.removeEventListener('mousemove', onMove);
      });
      xTo.current = null;
      yTo.current = null;
    };
  }, [containerSelector, imageAttribute]);

  return (
    <img
      ref={imgRef}
      className="it-img"
      alt=""
      aria-hidden="true"
    />
  );
}
