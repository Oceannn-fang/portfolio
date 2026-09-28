'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getNeteasePlaylist,
  getSpotifyAlbums,
  getSpotifyRecentlyPlayed,
} from '@/lib/heat-requests';
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
    // 并行预加载三个数据源：走 lib/heat-requests 共享请求层（get-or-start 单例），
    // 与后续 warmMusicCache/warmPlaylistCache 复用同一 Promise，同一会话只发一次网络请求；
    // 兜底触发后数据由组件侧自有的 loading/error 态自行加载/重试，不会白屏
    getSpotifyRecentlyPlayed()
      .then(() => checkDone())
      .catch(() => checkDone());
    getSpotifyAlbums()
      .then(() => checkDone())
      .catch(() => checkDone());
    getNeteasePlaylist()
      .then(() => checkDone())
      .catch(() => checkDone());

    // 超时保底：最多等 3 秒，超时直接跳过加载动画进入页面
    const timeout = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        setFading(true);
        setTimeout(onLoaded, 750);
      }
    }, 3000);

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
