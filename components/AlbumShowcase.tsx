'use client';

import { useState, useEffect } from 'react';
import './AlbumShowcase.css';

/**
 * 精选推荐 — 直接在 viewer 面板中展示 music-cover-3d 原版弧形动画
 * iframe 创建独立视口，原版的 position:fixed 和 window 尺寸引用自动适配
 * 延迟加载以避免 Three.js + WebGL 初始化阻塞主线程
 */
export default function AlbumShowcase() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 延迟加载，避免 hover 时立即阻塞主线程
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="as-root">
      {ready ? (
        <iframe
          className="as-iframe"
          src="/music-cover-3d/index.html"
          title="Arc Vinyl Archive"
          allow="autoplay"
          loading="lazy"
        />
      ) : (
        <div className="as-loading">加载中...</div>
      )}
    </div>
  );
}
