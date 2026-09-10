'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode, ElementType, Ref } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import './TextReveal.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface Props {
  /** 要揭示的文字内容（支持含 <i>、链接等内嵌节点的 JSX） */
  children: ReactNode;
  className?: string;
  /** 渲染的标签，默认 h2 */
  as?: ElementType;
  /** 每个词之间的动画间隔（秒） */
  stagger?: number;
  /** 单个词的动画时长（秒） */
  duration?: number;
  /** 词的初始上移距离（px） */
  y?: number;
  /** 初始模糊值（px） */
  blur?: number;
}

/**
 * 逐词滚动文字揭示组件：
 * 进入视口时按词逐个淡入 + 上移 + 去模糊（blur → clear），
 * 基于 GSAP SplitText + ScrollTrigger，只触发一次。
 */
export default function TextReveal({
  children,
  className = '',
  as: Tag = 'h2',
  stagger = 0.04,
  duration = 0.8,
  y = 30,
  blur = 8,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 按词切分；wordsClass 用于 CSS 控制分词后的布局
    const split = new SplitText(el, { type: 'words', wordsClass: 'tr-word' });

    const anim = gsap.from(split.words, {
      opacity: 0,
      y,
      filter: `blur(${blur}px)`,
      duration,
      stagger,
      ease: 'power3.out',
      // 动画结束后移除 will-change，释放合成层
      onComplete: () => split.words.forEach((word) => word.classList.add('tr-done')),
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    });

    return () => {
      // 先销毁 ScrollTrigger 与动画，再还原文本 DOM，避免卸载残留
      anim.scrollTrigger?.kill();
      anim.kill();
      split.revert();
    };
  }, [children, stagger, duration, y, blur]);

  return (
    <Tag ref={ref as Ref<never>} className={`tr-root ${className}`.trim()}>
      {children}
    </Tag>
  );
}
