'use client';

import './AlbumShowcase.css';

/**
 * 精选推荐 — 直接在 viewer 面板中展示 music-cover-3d 原版弧形动画
 * iframe 创建独立视口，原版的 position:fixed 和 window 尺寸引用自动适配
 */
export default function AlbumShowcase() {
  return (
    <div className="as-root">
      <iframe
        className="as-iframe"
        src="/music-cover-3d/index.html"
        title="Arc Vinyl Archive"
        allow="autoplay"
      />
    </div>
  );
}
