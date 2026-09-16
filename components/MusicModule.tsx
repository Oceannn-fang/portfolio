'use client';

import { useState, useEffect, useRef } from 'react';
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

// ── 模块级缓存：避免每次 viewer 打开都重新请求，1 小时过期 ──
let cachedTracks: Track[] | null = null;
let cachedAlbums: Album[] | null = null;
let cachedAuthed: boolean | null = null;
/** 缓存写入时间戳，用于判断是否超过 1 小时有效期 */
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 小时

/** 检查缓存是否在有效期内 */
function isCacheValid(): boolean {
  return cacheTimestamp > 0 && Date.now() - cacheTimestamp < CACHE_DURATION;
}

/** 外部可调用的缓存有效性检查（供 LoadingScreen 判断是否跳过加载动画） */
export function isMusicCacheValid(): boolean {
  return (cachedTracks !== null || cachedAlbums !== null) && isCacheValid();
}

// 预热进行中标记，避免重复请求
let warming = false;

// 已预解码的封面集合（模块级，会话内只解一次）
const warmedCovers = new Set<string>();
let warmingCovers = false;

/**
 * 空闲串行预解码 Spotify 封面：由 warmMusicCache 在数据到达后调用。
 * viewer 打开时首批封面同帧解码会带来打开瞬间掉帧，
 * 提前用 img.decode() 把解码摊到空闲期（与 AlbumShowcase/PlaylistModule 同模式）。
 */
function warmMusicCovers() {
  if (warmingCovers) return;
  const urls: string[] = [];
  for (const t of cachedTracks ?? []) {
    if (t.album?.imageUrl && !warmedCovers.has(t.album.imageUrl)) urls.push(t.album.imageUrl);
  }
  for (const a of cachedAlbums ?? []) {
    if (a.imageUrl && !warmedCovers.has(a.imageUrl)) urls.push(a.imageUrl);
  }
  if (urls.length === 0) return;
  warmingCovers = true;
  const pending = urls.slice(0, 30);
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
export function warmMusicCache() {
  if (warming) return;
  // 已有有效缓存（或已知未授权）则跳过
  if (isCacheValid() || cachedAuthed === false) return;
  warming = true;
  // 与组件内解析逻辑一致：兼容数组与包裹对象两种返回结构
  const load = async (url: string, apply: (data: unknown) => void) => {
    const res = await fetch(url);
    if (res.status === 401) {
      cachedAuthed = false;
      return;
    }
    if (!res.ok) return;
    apply(await res.json());
  };
  Promise.all([
    load('/api/spotify/recently-played', (data) => {
      const d = data as Track[] | { tracks?: Track[] };
      cachedTracks = Array.isArray(d) ? d : d.tracks ?? [];
    }),
    load('/api/spotify/albums', (data) => {
      const d = data as Album[] | { albums?: Album[] };
      cachedAlbums = Array.isArray(d) ? d : d.albums ?? [];
    }),
  ])
    .then(() => {
      // 任一接口成功拿到数据即视为已授权并刷新缓存时间戳
      if (cachedTracks || cachedAlbums) {
        if (cachedAuthed !== false) cachedAuthed = true;
        cacheTimestamp = Date.now();
        // 数据就绪后空闲预解码封面，降低 viewer 打开瞬间的解码压力
        warmMusicCovers();
      }
    })
    .catch(() => {
      // 预热失败不影响后续正常加载
    })
    .finally(() => {
      warming = false;
    });
}

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

  // 切换 tab 时拉取对应数据；有缓存且未过期则直接使用
  useEffect(() => {
    // 如果有缓存且已授权且未过期，跳过请求
    if (cachedAuthed === true && isCacheValid()) {
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
          cacheTimestamp = Date.now(); // 更新缓存时间戳
          setTracks(parsed);
        } else {
          const parsed = Array.isArray(data) ? data : data.albums ?? [];
          cachedAlbums = parsed;
          cacheTimestamp = Date.now(); // 更新缓存时间戳
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

  // ── 原生事件委托 ──
  // 本组件被渲染在 Gk3Clone 的 viewer 面板中，该面板 DOM 可能被手动搬移到
  // React 根容器之外，导致 React 的合成事件委托（onClick）无法捕获点击。
  // 因此改用原生 addEventListener 在组件根节点上做事件委托。
  /** 始终指向最新的点击处理逻辑，供原生监听器调用，避免闭包读到旧状态 */
  const clickHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  clickHandlerRef.current = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 点击落在 Spotify embed iframe 内部时忽略，避免误收起展开面板
    if (target.closest('iframe')) return;
    // Tab 切换
    const tab = target.closest('[data-tab]') as HTMLElement | null;
    if (tab) {
      setActiveTab(tab.dataset.tab as 'recent' | 'albums');
      return;
    }
    // 曲目行 / 专辑卡片：切换展开状态
    const expandable = target.closest(
      '[data-track-id], [data-album-id]'
    ) as HTMLElement | null;
    if (expandable) {
      toggleExpand(
        expandable.dataset.trackId ?? expandable.dataset.albumId ?? ''
      );
    }
  };

  // callback ref：组件有多个提前 return 分支，状态切换时 .mm-root 会被换成
  // 新节点；React 19 支持 callback ref 返回清理函数，节点替换/卸载时自动解绑，
  // 保证每个新节点都能正确绑定原生监听器
  const attachRoot = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handleClick = (e: MouseEvent) => clickHandlerRef.current(e);
    // hover 文本时测量是否溢出（scrollWidth > clientWidth），
    // 仅对真正被截断的歌名/艺人名添加 mm-marquee 滚动类，移出时移除
    const textSel =
      '.mm-track-name, .mm-track-artist, .mm-card-name, .mm-card-artist';
    const handleOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest(textSel);
      if (!el) return;
      if (el.scrollWidth > el.clientWidth) el.classList.add('mm-marquee');
    };
    const handleOut = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest(textSel);
      el?.classList.remove('mm-marquee');
    };
    node.addEventListener('click', handleClick);
    node.addEventListener('mouseover', handleOver);
    node.addEventListener('mouseout', handleOut);
    return () => {
      node.removeEventListener('click', handleClick);
      node.removeEventListener('mouseover', handleOver);
      node.removeEventListener('mouseout', handleOut);
    };
  };

  // 1. 未授权：居中授权按钮
  if (!authed) {
    return (
      <div className="mm-root" ref={attachRoot}>
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
      <div className="mm-root" ref={attachRoot}>
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
      <div className="mm-root" ref={attachRoot}>
        <div className="mm-error">{error}</div>
      </div>
    );
  }

  // 3. 正常渲染（点击行为由根节点上的原生事件委托处理，不使用 React onClick）
  return (
    <div className="mm-root" ref={attachRoot}>
      {/* Tabs */}
      <div className="mm-tabs">
        <button
          className={`mm-tab${activeTab === 'recent' ? ' active' : ''}`}
          data-tab="recent"
        >
          最近收听
        </button>
        <button
          className={`mm-tab${activeTab === 'albums' ? ' active' : ''}`}
          data-tab="albums"
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
                data-track-id={track.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="mm-track-img"
                  src={track.album.imageUrl}
                  alt={track.album.name}
                  decoding="async"
                />
                <div className="mm-track-info">
                  {/* data-text 供 CSS ::after 复制文本，hover 时 JS 测量溢出后加 mm-marquee 滚动 */}
                  <div className="mm-text">
                    <div className="mm-track-name" data-text={track.name}>
                      {track.name}
                    </div>
                  </div>
                  <div className="mm-text">
                    <div className="mm-track-artist" data-text={track.artist}>
                      {track.artist}
                    </div>
                  </div>
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
                data-album-id={album.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="mm-card-img"
                  src={album.imageUrl}
                  alt={album.name}
                  decoding="async"
                />
                <div className="mm-card-info">
                  <div className="mm-text">
                    <div className="mm-card-name" data-text={album.name}>
                      {album.name}
                    </div>
                  </div>
                  <div className="mm-text">
                    <div className="mm-card-artist" data-text={album.artist}>
                      {album.artist}
                    </div>
                  </div>
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
