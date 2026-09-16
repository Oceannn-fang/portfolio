'use client';

import { useEffect, useMemo, useState } from 'react';
import DriftWall from './DriftWall';
import { portfolioWorks } from '../lib/portfolio-images';
import './PortfolioModule.css';

interface PortfolioModuleProps {
  /** 当前选中的作品 ID；null 表示显示 DriftWall 总览 */
  selectedWork?: string | null;
  /** 点击单图时的回调（Gk3Clone 用它打开 TiltedCard 全屏浮层） */
  onOpenOverlay?: (workId: string) => void;
}

/**
 * 作品集 viewer 模块：
 * - 默认（hover 行标题时）：渲染 DriftWall 3D 漂移墙，展示全部作品缩略图
 * - 选中某个作品时（hover/点击行内条目）：渲染该作品的竖屏全图
 *
 * 性能设计（交互加载卡顿修复，数据见 trace）：
 * - DriftWall 常驻挂载，切单图只隐藏（display:none）：隐藏后 IntersectionObserver
 *   自动暂停漂移计算（不烧主线程），回总览零 DOM 重建、零图片重解码
 * - tile 全部使用 240×428 WebP 缩略图（原图 1080×1920 PNG 仅在单图模式加载）：
 *   99 tile 的解码开销从 ~110MB 原图降为 ~0.3MB 缩略图
 * - 空闲预解码：总览打开后在空闲时段串行 img.decode() 预热缩略图（预解码结果进
 *   Chromium 图片缓存；图不在 DOM 上不触发光栅，不产生交互帧竞争）
 * - 单图 decode 完成后再淡入：避免大图解码期间出现半渲染突变
 * - 单图点击 → onOpenOverlay 回调：Gk3Clone 用 TiltedCard 打开大图浮层
 */
export default function PortfolioModule({ selectedWork, onOpenOverlay }: PortfolioModuleProps) {
  // DriftWall 图块数据（memo 保持引用稳定，避免重启动画循环；tile 用缩略图，单图才用原图）
  const items = useMemo(
    () => portfolioWorks.map((w) => ({ image: w.thumb, title: w.title })),
    []
  );

  const work = selectedWork ? portfolioWorks.find((w) => w.id === selectedWork) : null;
  const workId = work?.id ?? null;

  // 单图淡入：decode（含网络）完成后再显示
  const [singleReady, setSingleReady] = useState(false);
  useEffect(() => {
    if (!workId) {
      setSingleReady(false);
      return;
    }
    let cancelled = false;
    const target = portfolioWorks.find((w) => w.id === workId);
    const img = new Image();
    img.src = target?.image ?? '';
    const reveal = () => {
      if (!cancelled) setSingleReady(true);
    };
    // 预热中的解码缓存对同 src 直接命中；失败时也显示（走原生加载行为）
    img.decode().then(reveal, reveal);
    return () => {
      cancelled = true;
    };
  }, [workId]);

  // 空闲预解码：总览模式下串行预热全部缩略图（tile 直接命中缓存，原图仅在切单图时加载）
  useEffect(() => {
    if (workId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    let i = 0;
    const step = () => {
      if (cancelled || i >= portfolioWorks.length) return;
      const img = new Image();
      img.src = portfolioWorks[i++].thumb;
      const advance = () => {
        if (!cancelled) timer = setTimeout(step, 50);
      };
      img.decode().then(advance, advance);
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(step, { timeout: 2000 });
    } else {
      timer = setTimeout(step, 800);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [workId]);

  // 单张作品全图模式：直接铺满，不加边框和标题
  return (
    <>
      {/* 总览常驻挂载：切单图只隐藏（display:none 触发 IntersectionObserver 暂停漂移），
          避免切回总览时 99 tile DOM 重建与 33 张大图重解码 */}
      <div className="pom-root" style={work ? { display: 'none' } : undefined}>
        <DriftWall
          items={items}
          columns={4}
          tileWidth={120}
          tileHeight={213}
          gap={8}
          tilt={10}
          turn={-8}
          perspective={1000}
          depth={60}
          speed={30}
          direction="up"
          variance={0.3}
          parallax={0.4}
          lift={30}
          fade={0.5}
          dim={0.45}
          overlayColor="#0b0b09"
          radius={6}
        />
      </div>
      {work ? (
        <div className="pom-root pom-single">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={work.image}
            alt={work.title}
            className={`pom-single-img${singleReady ? ' is-ready' : ''}`}
            decoding="async"
            title="点击查看大图"
            onClick={() => onOpenOverlay?.(work.id)}
          />
        </div>
      ) : null}
    </>
  );
}
