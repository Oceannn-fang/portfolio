'use client';

// 精选推荐 —— 竖向双轨循环专辑封面 + 中央唱片按钮 + 全屏浮层入口
// 设计意图：呼应 music-cover-3d 的"弧形唱片档案"美学，
// 在 viewer 面板内以编辑级排版呈现预览态，中央按钮为进入 3D 版本的仪式性入口。

import { useEffect, useMemo, useState } from 'react';
import { recentAlbums } from '@/lib/data';
import './AlbumShowcase.css';

type AlbumShowcaseProps = {
  /** 由父级 Gk3Clone 控制浮层显隐，让行项目点击也能触发 */
  onOpenOverlay?: () => void;
};

export default function AlbumShowcase({ onOpenOverlay }: AlbumShowcaseProps) {
  // 从 recentAlbums 中截取前 12 张封面，避免过多 DOM
  const covers = useMemo(
    () => recentAlbums.slice(0, 12).map((album) => ({ src: album.src, name: album.name, artist: album.artist })),
    []
  );

  // 组件内部按钮直接开启浮层；若父级传入回调则委托父级（父级会在根部渲染浮层，避免 viewer 卸载时浮层被销毁）
  const handleEnter = () => {
    if (onOpenOverlay) onOpenOverlay();
  };

  // 键盘可达性：Enter / Space 触发
  const handleKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleEnter();
    }
  };

  // 当前高亮的封面序号（用于底部计数器装饰）
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => (value + 1) % covers.length), 2400);
    return () => window.clearInterval(timer);
  }, [covers.length]);

  // 双轨道：左轨向上、右轨向下；复制两份实现无缝循环
  const laneA = covers;
  const laneB = [...covers].reverse();

  return (
    <div className="as-root">
      {/* 背景层：颗粒 + 弧形光晕 + 暗角 */}
      <div className="as-bg" aria-hidden="true">
        <div className="as-bg-glow" />
        <div className="as-bg-arc as-bg-arc-a" />
        <div className="as-bg-arc as-bg-arc-b" />
        <div className="as-bg-vignette" />
        <div className="as-bg-grain" />
      </div>

      {/* 侧向编辑标签 */}
      <div className="as-side-label as-side-label-left" aria-hidden="true">
        <span>arc</span>
        <em />
        <span>vinyl</span>
        <em />
        <span>archive</span>
      </div>
      <div className="as-side-label as-side-label-right" aria-hidden="true">
        <span>vol.</span>
        <strong>01</strong>
        <span>/ 3d shelf</span>
      </div>

      {/* 双轨循环封面 */}
      <div className="as-lanes" aria-hidden="true">
        <div className="as-lane as-lane-left">
          <div className="as-track as-track-up">
            {[...laneA, ...laneA].map((album, index) => (
              <figure className="as-cover" key={`a-${index}`}>
                <img src={album.src} alt="" loading="lazy" decoding="async" />
                <figcaption>
                  <span className="as-cover-name">{album.name}</span>
                  <span className="as-cover-artist">{album.artist}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div className="as-lane as-lane-right">
          <div className="as-track as-track-down">
            {[...laneB, ...laneB].map((album, index) => (
              <figure className="as-cover as-cover-alt" key={`b-${index}`}>
                <img src={album.src} alt="" loading="lazy" decoding="async" />
                <figcaption>
                  <span className="as-cover-name">{album.name}</span>
                  <span className="as-cover-artist">{album.artist}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        {/* 中央竖向渐隐遮罩，让封面在按钮后方淡出 */}
        <div className="as-lane-mask" />
      </div>

      {/* 中央入口按钮：外圈旋转虚线环 + 内部黑胶唱片 */}
      <button
        type="button"
        className="as-cta"
        onClick={handleEnter}
        onKeyDown={handleKey}
        aria-label="打开 3D 唱片架"
      >
        <span className="as-cta-ring" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <defs>
              <path
                id="as-cta-circle"
                d="M 100, 100 m -74, 0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
              />
            </defs>
            <text className="as-cta-ring-text">
              <textPath href="#as-cta-circle" startOffset="0%">
                · enter the arc · vinyl archive · 3d shelf · click to explore
              </textPath>
            </text>
          </svg>
        </span>
        <span className="as-cta-disc" aria-hidden="true">
          <span className="as-cta-groove" />
          <span className="as-cta-groove as-cta-groove-2" />
          <span className="as-cta-label">
            <span className="as-cta-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
              </svg>
            </span>
            <span className="as-cta-text">
              <em>explore</em>
              <strong>3d shelf</strong>
            </span>
          </span>
          <span className="as-cta-hole" />
        </span>
      </button>

      {/* 底部序号计数器 */}
      <div className="as-footer" aria-hidden="true">
        <span className="as-footer-count">
          {String(tick + 1).padStart(2, '0')}
          <i>/</i>
          {String(covers.length).padStart(2, '0')}
        </span>
        <span className="as-footer-hint">
          <span className="as-footer-dot" />
          now spinning · click disc to enter
        </span>
      </div>
    </div>
  );
}
