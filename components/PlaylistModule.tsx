'use client';

import { useState, useEffect, useRef } from 'react';
import './PlaylistModule.css';

interface Track {
  id: number;
  name: string;
  artists: string;
  album: string;
  cover: string;
  duration: number;
}

// 模块级缓存：面板反复开关时不重复请求
let cachedData: { name: string; tracks: Track[] } | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 缓存有效期 1 小时
// 预热进行中标记，避免重复请求
let warming = false;

/** 预加载：由 Gk3Clone 在页面空闲时调用，提前写入模块缓存，hover 打开面板时秒开 */
export function warmPlaylistCache() {
  // 已有有效缓存或正在预热中则跳过
  if (warming) return;
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) return;
  warming = true;
  fetch('/api/netease/playlist')
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json) {
        cachedData = { name: json.name, tracks: json.tracks };
        cacheTime = Date.now();
      }
    })
    .catch(() => {
      // 预热失败不影响后续正常加载
    })
    .finally(() => {
      warming = false;
    });
}

/**
 * 网易云精选歌单模块
 * 顶部固定播放器，点击曲目即播（外链直连，失败时回退网易云 iframe 播放器）
 */
export default function PlaylistModule() {
  const [tracks, setTracks] = useState<Track[]>(cachedData?.tracks || []);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  // 外链播放失败（VIP/版权 403）时回退 iframe 播放器
  const [useIframe, setUseIframe] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 加载歌单数据 + 定时刷新
  useEffect(() => {
    const fetchData = () => {
      fetch('/api/netease/playlist')
        .then((res) => {
          if (!res.ok) throw new Error('加载失败');
          return res.json();
        })
        .then((json) => {
          cachedData = { name: json.name, tracks: json.tracks };
          cacheTime = Date.now();
          setTracks(json.tracks);
          setLoading(false);
        })
        .catch((err) => {
          // 已有缓存时静默失败，保留旧数据
          if (!cachedData) setError(err.message);
          setLoading(false);
        });
    };

    // 缓存有效则直接复用
    if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
      setTracks(cachedData.tracks);
      setLoading(false);
    } else {
      fetchData();
    }

    // 每 10 分钟检查一次，缓存过期则重新拉取（歌单会不定时更新）
    const interval = setInterval(() => {
      if (Date.now() - cacheTime >= CACHE_TTL) {
        fetchData();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // 点击歌曲 → 顶部播放器播放（实际播放在 useEffect 中执行，确保 audio 元素已渲染）
  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setUseIframe(false);
  };

  // 当前曲目变化 → 设置外链并播放
  useEffect(() => {
    if (!currentTrack || useIframe || !audioRef.current) return;
    // 网易云外链直连，部分歌曲可能 403（触发 error 后回退 iframe）
    audioRef.current.src = `https://music.163.com/song/media/outer/url?id=${currentTrack.id}.mp3`;
    audioRef.current.play().catch(() => {});
  }, [currentTrack, useIframe]);

  // 外链加载失败（403/版权限制）→ 回退网易云 iframe 播放器
  const handleAudioError = () => {
    // 无 src 时浏览器也会触发 error 事件，需排除
    if (currentTrack && audioRef.current?.src) setUseIframe(true);
  };

  // 毫秒 → m:ss
  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading)
    return (
      <div className="pm-root">
        <div className="pm-loading">加载中...</div>
      </div>
    );
  if (error)
    return (
      <div className="pm-root">
        <div className="pm-error">{error}</div>
      </div>
    );

  return (
    <div className="pm-root">
      {/* 顶部播放器 */}
      <div className="pm-player">
        {currentTrack ? (
          <>
            <img className="pm-player-cover" src={currentTrack.cover} alt="" />
            <div className="pm-player-info">
              <span className="pm-player-name">{currentTrack.name}</span>
              <span className="pm-player-artist">{currentTrack.artists}</span>
            </div>
          </>
        ) : (
          <div className="pm-player-empty">
            <span>点击歌曲开始播放</span>
          </div>
        )}
      </div>

      {/* 播放控件：优先原生 audio，外链失败时回退网易云 iframe */}
      {currentTrack && (
        <div className="pm-player-bar">
          {useIframe ? (
            <iframe
              className="pm-player-iframe"
              src={`https://music.163.com/outchain/player?type=2&id=${currentTrack.id}&auto=1&height=66`}
              width="100%"
              height="66"
              frameBorder="no"
              allow="autoplay"
              title={`${currentTrack.name} - 网易云播放器`}
            />
          ) : (
            <audio
              ref={audioRef}
              controls
              className="pm-audio"
              onError={handleAudioError}
            />
          )}
        </div>
      )}
      {/* 未选中歌曲时也挂载 audio 元素，保证 ref 可用 */}
      {!currentTrack && <audio ref={audioRef} className="pm-audio-hidden" onError={handleAudioError} />}

      {/* 曲目列表 */}
      <div className="pm-list">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`pm-track-row${currentTrack?.id === track.id ? ' pm-track-active' : ''}`}
            onClick={() => playTrack(track)}
          >
            <span className="pm-track-num">{(index + 1).toString().padStart(2, '0')}</span>
            <img className="pm-track-cover" src={track.cover} alt="" loading="lazy" />
            <div className="pm-track-info">
              <span className="pm-track-name">{track.name}</span>
              <span className="pm-track-artist">{track.artists}</span>
            </div>
            <span className="pm-track-duration">{formatDuration(track.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
