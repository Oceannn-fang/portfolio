'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getNeteasePlaylist,
  getSpotifyAlbumsRaw,
  getSpotifyRecentlyPlayedRaw,
} from '@/lib/heat-requests';
import './LoadingScreen.css';

interface Props {
  onLoaded: () => void;
}

/**
 * 加载动画 — 首次访问时显示，后台并行预加载数据源，完成后淡出过渡到主页面。
 * 设计语言：深色 + 黑胶唱片旋转环 + 极细进度线 + Ellograph 字体呼吸动效。
 *
 * #71 放行策略：遮罩只阻塞等待快源（网易云歌单，实测线上 ~0.2s）；
 * Spotify 两路仅后台预热（不阻塞放行）——线上冷启动时 Spotify 需要
 * refresh_token→access_token 交换 + 冷 lambda，实测 >3s 会拖到 3s 兜底路径
 * （遮罩 5251ms 的真因）。MusicModule 自身有 loading 态，数据晚到不白屏；
 * 预热走 lib/heat-requests 共享层，与 warmMusicCache 复用同一 Promise，不重复下载。
 */
export default function LoadingScreen({ onLoaded }: Props) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const completedRef = useRef(0);
  const doneRef = useRef(false);

  const total = 3; // 进度条仍按三源展示（spotify 两路晚到只影响进度观感，不阻塞放行）

  /** 单个数据源完成时调用；仅快源（网易云）计入放行门槛 */
  const makeOnDone = useCallback(
    (gating: boolean) => () => {
      completedRef.current++;
      setProgress(Math.round((Math.min(completedRef.current, total) / total) * 100));
      if (!gating) return;
      if (doneRef.current) return;
      doneRef.current = true;
      setFading(true);
      setTimeout(onLoaded, 750); // 等淡出动画完成
    },
    [onLoaded, total]
  );

  useEffect(() => {
    // 三源均经 lib/heat-requests 共享请求层（get-or-start 单例）预热：
    // 与后续 warmMusicCache/warmPlaylistCache 复用同一 Promise，同一会话只发一次网络请求。
    // 放行只等网易云（gating=true）；Spotify 两路后台续拉（gating=false），
    // 数据到达后由 MusicModule 的缓存/loading 态自行消费。
    // Spotify 用 raw 模式（与 warmMusicCache 同模式）：同一去重条目内
    // 缓存的始终是 Response clone，避免 parse/raw 两种消费方式串模式
    getNeteasePlaylist()
      .then(makeOnDone(true))
      .catch(makeOnDone(true));
    getSpotifyRecentlyPlayedRaw()
      .then(makeOnDone(false))
      .catch(makeOnDone(false));
    getSpotifyAlbumsRaw()
      .then(makeOnDone(false))
      .catch(makeOnDone(false));

    // 超时保底：最多等 3 秒（针对快源挂死/极慢的异常情况），超时直接跳过加载动画进入页面
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
