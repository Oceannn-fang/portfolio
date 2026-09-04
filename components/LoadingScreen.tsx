'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import './LoadingScreen.css';

interface Props {
  onLoaded: () => void;
}

/**
 * 加载动画 — 首次访问时显示，后台并行预加载数据源，完成后淡出过渡到主页面。
 * 设计语言：深色 + 黑胶唱片旋转环 + 极细进度线 + Ellograph 字体呼吸动效。
 */
export default function LoadingScreen({ onLoaded }: Props) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const completedRef = useRef(0);
  const doneRef = useRef(false);

  const total = 3; // spotify recently-played + spotify albums + netease playlist

  /** 单个数据源完成时调用 */
  const checkDone = useCallback(() => {
    if (doneRef.current) return;
    completedRef.current++;
    setProgress(Math.round((completedRef.current / total) * 100));
    if (completedRef.current >= total) {
      doneRef.current = true;
      setFading(true);
      setTimeout(onLoaded, 750); // 等淡出动画完成
    }
  }, [onLoaded, total]);

  useEffect(() => {
    // 并行预加载三个数据源（与 warmMusicCache/warmPlaylistCache 请求相同接口，
    // 浏览器 HTTP 缓存 + 模块级缓存保证不会重复网络请求）
    fetch('/api/spotify/recently-played')
      .then(() => checkDone())
      .catch(() => checkDone());
    fetch('/api/spotify/albums')
      .then(() => checkDone())
      .catch(() => checkDone());
    fetch('/api/netease/playlist')
      .then(() => checkDone())
      .catch(() => checkDone());

    // 超时保底：最多等 8 秒，超时直接跳过加载动画
    const timeout = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        setFading(true);
        setTimeout(onLoaded, 750);
      }
    }, 8000);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`ls-root${fading ? ' ls-fading' : ''}`}>
      <div className="ls-content">
        {/* 装饰：旋转黑胶环 */}
        <div className="ls-ring" aria-hidden="true" />
        <div className="ls-ring-inner" aria-hidden="true" />

        {/* Logo */}
        <div className="ls-logo">GK3</div>

        {/* 进度条 */}
        <div className="ls-bar">
          <div
            className="ls-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 状态文字 */}
        <div className="ls-text">loading</div>
      </div>
    </div>
  );
}
