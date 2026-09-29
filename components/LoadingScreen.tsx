'use client';

// #98：本组件已下线挂载（Gk3Clone 不再渲染首屏遮罩，主内容挂载即渲染）；
// 文件与样式保留备用，后续若需重新引入启动动画可直接复用。

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

/** #76 门控独立超时：放行时刻 = min(网易云完成, 本值)；冷 lambda 下网易云可达 5.5-7.3s，不能再等 */
const GATE_TIMEOUT_MS = 1500;

/** 淡出动画时长（与 LoadingScreen.css 的 transition 对齐），完成后回调 onLoaded */
const FADE_MS = 750;

/**
 * 加载动画 — 首次访问时显示，后台并行预加载数据源，完成后淡出过渡到主页面。
 * 设计语言：深色 + 黑胶唱片旋转环 + 极细进度线 + Ellograph 字体呼吸动效。
 *
 * #71 放行策略：遮罩只阻塞等待快源（网易云歌单）；Spotify 两路仅后台预热
 * （不阻塞放行）——线上冷启动时 Spotify 需要 refresh_token→access_token 交换
 * + 冷 lambda，实测 >3s 会拖到兜底路径（5251ms 的真因）。MusicModule 自身有
 * loading 态，数据晚到不白屏；预热走 lib/heat-requests 共享层，不重复下载。
 *
 * #76 门控收紧：网易云在 Vercel serverless 冷启动实测 5.5-7.3s（>3s 旧兜底），
 * 仍会拖满兜底路径（5423ms）。改为独立超时门控：放行时刻 =
 * min(网易云完成, 1.5s)——热/正常路径行为不变（数据到了就放行），冷启动最多等
 * 1.5s。原外层 3s 兜底与之合并移除（1.5s 门控必然先到，3s 兜底已成死代码）。
 * 提前放行后网易云歌单模块有自己的 loading 态（"加载中..."），不白屏。
 */
export default function LoadingScreen({ onLoaded }: Props) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const completedRef = useRef(0);
  const doneRef = useRef(false);
  const gateTimerRef = useRef<number | null>(null);

  const total = 3; // 进度条仍按三源展示（spotify 两路晚到只影响进度观感，不阻塞放行）

  /** 更新进度条（不等真等满门控超时，数据到了就到头） */
  const bumpProgress = useCallback(() => {
    completedRef.current++;
    setProgress(Math.round((Math.min(completedRef.current, total) / total) * 100));
  }, [total]);

  /** 放行：淡出并在动画完成后 onLoaded（doneRef 防重，数据完成/超时先到先得） */
  const release = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (gateTimerRef.current !== null) {
      clearTimeout(gateTimerRef.current);
      gateTimerRef.current = null;
    }
    setFading(true);
    setTimeout(onLoaded, FADE_MS); // 等淡出动画完成
  }, [onLoaded]);

  /** 非门控源（Spotify 两路）完成：仅更新进度 */
  const onSourceDone = useCallback(() => {
    bumpProgress();
  }, [bumpProgress]);

  /** 门控源（网易云）完成：更新进度并放行（不白等） */
  const onGateSourceDone = useCallback(() => {
    bumpProgress();
    release();
  }, [bumpProgress, release]);

  useEffect(() => {
    // 三源均经 lib/heat-requests 共享请求层（get-or-start 单例）预热：
    // 与后续 warmMusicCache/warmPlaylistCache 复用同一 Promise，同一会话只发一次网络请求。
    // 放行只等网易云；Spotify 两路后台续拉，数据到达后由 MusicModule 的缓存/loading 态自行消费。
    // Spotify 用 raw 模式（与 warmMusicCache 同模式）：同一去重条目内
    // 缓存的始终是 Response clone，避免 parse/raw 两种消费方式串模式
    getNeteasePlaylist()
      .then(onGateSourceDone)
      .catch(onGateSourceDone);
    getSpotifyRecentlyPlayedRaw()
      .then(onSourceDone)
      .catch(onSourceDone);
    getSpotifyAlbumsRaw()
      .then(onSourceDone)
      .catch(onSourceDone);

    // #76 门控独立超时：网易云未在 1.5s 内完成也放行（冷启动不拖遮罩）
    gateTimerRef.current = window.setTimeout(release, GATE_TIMEOUT_MS);

    return () => {
      if (gateTimerRef.current !== null) {
        clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
      }
    };
  }, [onGateSourceDone, onSourceDone, release]);

  return (
    <div className={`ls-root${fading ? ' ls-fading' : ''}`}>
      <div className="ls-content">
        {/* 装饰：旋转黑胶环 */}
        <div className="ls-ring" aria-hidden="true" />
        <div className="ls-ring-inner" aria-hidden="true" />

        {/* Logo：#78 清除原作者标识 GK3，改用站点标题（"Works, Notes, and Unfinished."）首字母 W——保留容器以维持 column 流槽位与 ls-breathe 呼吸动效，避免进度条/文字整体位移 */}
        <div className="ls-logo">W</div>

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
