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

/** 外部可调用的缓存有效性检查（供 LoadingScreen 判断是否跳过加载动画） */
export function isPlaylistCacheValid(): boolean {
  return cachedData !== null && Date.now() - cacheTime < CACHE_TTL;
}
// 预热进行中标记，避免重复请求
let warming = false;

// 已预解码的封面集合（模块级，会话内只解一次）
const warmedCovers = new Set<string>();
let warmingCovers = false;

/**
 * 空闲串行预解码歌单封面：由 warmPlaylistCache 在数据到达后调用。
 * viewer 打开时首批 30 张封面同帧解码会造成打开瞬间掉帧，
 * 提前用 img.decode() 把解码摊到空闲期（与 AlbumShowcase 预解码同模式）。
 */
function warmPlaylistCovers(tracks: Track[]) {
  if (warmingCovers) return;
  const pending = tracks
    .slice(0, 30)
    .map((t) => t.cover)
    .filter((url) => url && !warmedCovers.has(url));
  if (pending.length === 0) return;
  warmingCovers = true;
  const decodeNext = (index: number) => {
    if (index >= pending.length) {
      warmingCovers = false;
      return;
    }
    const url = pending[index];
    const img = new Image();
    img.src = url;
    img.decode()
      .then(() => {
        warmedCovers.add(url);
      })
      .catch(() => {
        // 外链封面可能失效/跨域失败，不重试，viewer 挂载时由浏览器正常加载
      })
      .finally(() => {
        setTimeout(() => decodeNext(index + 1), 50);
      });
  };
  decodeNext(0);
}

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
        // 数据就绪后空闲预解码首批封面，降低 viewer 打开瞬间的解码压力
        warmPlaylistCovers(json.tracks);
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
 * 顶部固定原生 audio 播放器，点击曲目即播（外链直连，失败时仅提示，不用 iframe）
 * 曲目列表分批加载：先渲染前 30 首，滚动到底部自动加载更多，避免 500+ 首一次性渲染卡顿
 */
export default function PlaylistModule() {
  const [tracks, setTracks] = useState<Track[]>(cachedData?.tracks || []);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  // 外链播放失败（VIP/版权 403）时显示提示
  const [playError, setPlayError] = useState(false);
  // 分批加载：当前已渲染的曲目数量
  const [visibleCount, setVisibleCount] = useState(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // 滚动到底部（距离 < 100px）时加载更多曲目
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        setVisibleCount((prev) => {
          if (prev >= tracks.length) return prev;
          return Math.min(prev + 30, tracks.length);
        });
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [tracks.length]);

  // 点击歌曲 → 顶部播放器播放（实际播放在 useEffect 中执行，确保 audio 元素已渲染）
  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setPlayError(false);
  };

  // 当前曲目变化 → 设置外链并播放；部分歌曲可能 403，play() 失败或流加载出错时显示提示
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    audioRef.current.src = `https://music.163.com/song/media/outer/url?id=${currentTrack.id}.mp3`;
    audioRef.current.play().catch(() => {
      setPlayError(true);
    });
  }, [currentTrack]);

  // 外链流加载失败（403/版权限制）→ 显示“暂不支持播放”提示
  const handleAudioError = () => {
    // 无 src 时浏览器也会触发 error 事件，需排除
    if (currentTrack && audioRef.current?.src) setPlayError(true);
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
      {/* 顶部播放器：封面 + 曲目信息 + 原生 audio 控件（播放失败时显示提示） */}
      <div className="pm-player">
        {currentTrack ? (
          <>
            <img className="pm-player-cover" src={currentTrack.cover} alt="" decoding="async" />
            <div className="pm-player-info">
              <span className="pm-player-name">{currentTrack.name}</span>
              <span className="pm-player-artist">{currentTrack.artists}</span>
            </div>
            {playError ? (
              <span className="pm-player-error">该歌曲暂不支持在线播放</span>
            ) : (
              <audio
                ref={audioRef}
                controls
                className="pm-audio"
                onError={handleAudioError}
              />
            )}
          </>
        ) : (
          <div className="pm-player-empty">
            <span>点击歌曲开始播放</span>
          </div>
        )}
      </div>
      {/* 未选中歌曲或播放失败时也挂载 audio 元素，保证 ref 可用 */}
      {(!currentTrack || playError) && (
        <audio ref={audioRef} className="pm-audio-hidden" onError={handleAudioError} />
      )}

      {/* 曲目列表：分批渲染，滚动到底部自动加载更多 */}
      <div className="pm-list" ref={listRef}>
        {tracks.slice(0, visibleCount).map((track) => (
          <div
            key={track.id}
            className={`pm-track-row${currentTrack?.id === track.id ? ' pm-track-active' : ''}`}
            onClick={() => playTrack(track)}
          >
            <img className="pm-track-cover" src={track.cover} alt="" loading="lazy" decoding="async" />
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
