'use client';

import { useState, useEffect } from 'react';
import './MusicModule.css';

// ── 数据类型定义 ──

/** 最近收听曲目 */
interface Track {
  id: string;
  name: string;
  artist: string;
  album: { id: string; name: string; imageUrl: string };
  playedAt: string;
}

/** 专辑 */
interface Album {
  id: string;
  name: string;
  artist: string;
  imageUrl: string;
  releaseDate: string;
  totalTracks: number;
}

/** 专辑内曲目 */
interface AlbumTrack {
  id: string;
  name: string;
  durationMs: number;
  trackNumber: number;
  previewUrl: string | null;
}

// ── 工具函数 ──

/** 相对时间格式化：x分钟前 / x小时前 / x天前 */
function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

/** 时长格式化：m:ss */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ── 模块级缓存：避免每次 viewer 打开都重新请求 ──
let cachedTracks: Track[] | null = null;
let cachedAlbums: Album[] | null = null;
let cachedAuthed: boolean | null = null;

// ── 组件 ──

/**
 * MusicModule：嵌入 Gk3Clone viewer 面板的音乐模块。
 * 展示 Spotify 最近收听与专辑推荐，支持展开官方 Embed 播放器。
 */
export default function MusicModule() {
  const [activeTab, setActiveTab] = useState<'recent' | 'albums'>('recent');
  // 初始化时直接使用缓存，跳过 loading 态
  const [tracks, setTracks] = useState<Track[]>(cachedTracks ?? []);
  const [albums, setAlbums] = useState<Album[]>(cachedAlbums ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [albumTracks, setAlbumTracks] = useState<AlbumTrack[] | null>(null);
  const [loading, setLoading] = useState(!cachedTracks);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(cachedAuthed !== false);

  // 切换 tab 时拉取对应数据；有缓存则直接使用
  useEffect(() => {
    // 如果有缓存且已授权，跳过请求
    if (cachedAuthed === true) {
      if (activeTab === 'recent' && cachedTracks) {
        setTracks(cachedTracks);
        setLoading(false);
        setError(null);
        return;
      }
      if (activeTab === 'albums' && cachedAlbums) {
        setAlbums(cachedAlbums);
        setLoading(false);
        setError(null);
        return;
      }
    }
    // 已知未授权，直接显示授权按钮
    if (cachedAuthed === false) {
      setAuthed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      setExpandedId(null);
      setAlbumTracks(null);
      try {
        const url =
          activeTab === 'recent'
            ? '/api/spotify/recently-played'
            : '/api/spotify/albums';
        const res = await fetch(url);
        if (cancelled) return;
        if (res.status === 401) {
          cachedAuthed = false;
          setAuthed(false);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`请求失败（${res.status}）`);
        const data = await res.json();
        if (cancelled) return;
        cachedAuthed = true;
        setAuthed(true);
        if (activeTab === 'recent') {
          const parsed = Array.isArray(data) ? data : data.tracks ?? [];
          cachedTracks = parsed;
          setTracks(parsed);
        } else {
          const parsed = Array.isArray(data) ? data : data.albums ?? [];
          cachedAlbums = parsed;
          setAlbums(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || '加载失败，请稍后重试');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [activeTab]);

  // 展开专辑时拉取其曲目列表
  async function loadAlbumTracks(albumId: string) {
    setAlbumTracks(null);
    try {
      const res = await fetch(`/api/spotify/album-tracks/${albumId}`);
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setAlbumTracks(Array.isArray(data) ? data : data.tracks ?? []);
    } catch {
      // 曲目加载失败不阻断 embed 展示
    }
  }

  // 点击行/卡片：切换展开状态
  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setAlbumTracks(null);
      return;
    }
    setExpandedId(id);
    if (activeTab === 'albums') loadAlbumTracks(id);
    else setAlbumTracks(null);
  }

  // 1. 未授权：居中授权按钮
  if (!authed) {
    return (
      <div className="mm-root">
        <div className="mm-auth">
          <a className="mm-auth-btn" href="/api/auth/spotify">
            连接 Spotify
          </a>
        </div>
      </div>
    );
  }

  // 2. 加载中：三个跳动圆点
  if (loading) {
    return (
      <div className="mm-root">
        <div className="mm-loading">
          <span className="mm-dot" />
          <span className="mm-dot" />
          <span className="mm-dot" />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="mm-root">
        <div className="mm-error">{error}</div>
      </div>
    );
  }

  // 3. 正常渲染
  return (
    <div className="mm-root">
      {/* Tabs */}
      <div className="mm-tabs">
        <button
          className={`mm-tab${activeTab === 'recent' ? ' active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          最近收听
        </button>
        <button
          className={`mm-tab${activeTab === 'albums' ? ' active' : ''}`}
          onClick={() => setActiveTab('albums')}
        >
          最近专辑
        </button>
      </div>

      <div className="mm-content">
        {/* 最近收听：曲目列表，点击展开 track embed */}
        {activeTab === 'recent' &&
          tracks.map((track) => (
            <div key={track.id + track.playedAt}>
              <div
                className="mm-track-item"
                onClick={() => toggleExpand(track.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="mm-track-img"
                  src={track.album.imageUrl}
                  alt={track.album.name}
                />
                <div className="mm-track-info">
                  <div className="mm-track-name">{track.name}</div>
                  <div className="mm-track-artist">{track.artist}</div>
                </div>
                <div className="mm-track-time">
                  {formatTimeAgo(track.playedAt)}
                </div>
              </div>
              {/* 性能优化：仅展开的曲目才挂载 iframe，避免大量 Spotify Embed 同时加载 */}
              {expandedId === track.id && (
                <div className="mm-expand open">
                  <div className="mm-expand-inner">
                    <div className="mm-embed">
                      <iframe
                        src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator`}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={`${track.name} - ${track.artist}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* 专辑推荐：网格卡片，点击展开详情 + album embed + 曲目 */}
        {activeTab === 'albums' && (
          <div className="mm-grid">
            {albums.map((album) => (
              <div
                key={album.id}
                className="mm-card"
                onClick={() => toggleExpand(album.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="mm-card-img"
                  src={album.imageUrl}
                  alt={album.name}
                />
                <div className="mm-card-info">
                  <div className="mm-card-name">{album.name}</div>
                  <div className="mm-card-artist">{album.artist}</div>
                </div>
                {/* 性能优化：仅展开的专辑才挂载 iframe 与曲目列表 */}
                {expandedId === album.id && (
                  <div className="mm-expand open">
                    <div className="mm-expand-inner">
                      <div className="mm-embed">
                        <iframe
                          src={`https://open.spotify.com/embed/album/${album.id}?utm_source=generator`}
                          width="100%"
                          height="352"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          title={`${album.name} - ${album.artist}`}
                        />
                      </div>
                      {/* 专辑曲目列表 */}
                      {albumTracks && (
                        <div className="mm-album-tracks">
                          {albumTracks.map((t) => (
                            <div key={t.id} className="mm-album-track">
                              <span className="mm-album-track-num">
                                {t.trackNumber}
                              </span>
                              <span className="mm-album-track-name">{t.name}</span>
                              <span className="mm-album-track-dur">
                                {formatDuration(t.durationMs)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
